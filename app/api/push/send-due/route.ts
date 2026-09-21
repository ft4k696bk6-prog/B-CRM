import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server-auth";
import { hashPushSecret, sendWebPush } from "@/lib/web-push";

export const runtime = "nodejs";
export const maxDuration = 300;

type SubscriptionRow = {
  id: string;
  profile_id: string;
  crm_environment: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  notification_time: string;
};

type Task = {
  at: string;
  label: string;
  name: string;
  url: string;
};

function warsawParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${value.year}-${value.month}-${value.day}`,
    minutes: Number(value.hour) * 60 + Number(value.minute)
  };
}

function dateKeyWarsaw(value: string) {
  return warsawParts(new Date(value)).dateKey;
}

function timeWarsaw(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function targetMinutes(value: string) {
  const [hour, minute] = String(value).slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function taskSummary(tasks: Task[]) {
  const callbacks = tasks.filter((task) => task.label === "Call back").length;
  const meetings = tasks.filter((task) => task.label === "Spotkanie").length;
  const internal = tasks.length - callbacks - meetings;
  const counts = [
    callbacks ? `${callbacks} call-back${callbacks === 1 ? "" : "i"}` : "",
    meetings ? `${meetings} spotkanie${meetings === 1 ? "" : meetings < 5 ? "ia" : "ń"}` : "",
    internal ? `${internal} inne` : ""
  ].filter(Boolean).join(", ");
  const preview = tasks.slice(0, 3).map((task) => `${timeWarsaw(task.at)} ${task.name}`).join(" · ");
  return {
    title: `B-CRM · dziś: ${counts || "brak zadań"}`,
    body: preview || "Na dziś nie masz zaplanowanych call-backów ani spotkań."
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get("x-bcrm-push-token") || url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 403 });

  const supabase = getServiceClient();
  const { data: config } = await supabase
    .from("push_config")
    .select("vapid_public_key,vapid_private_jwk,vapid_subject,cron_token_hash")
    .eq("id", "default")
    .maybeSingle();

  if (!config || hashPushSecret(token) !== config.cron_token_hash) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 403 });
  }

  const { dateKey, minutes } = warsawParts();
  const { data: allSubscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id,profile_id,crm_environment,endpoint,p256dh,auth,notification_time")
    .eq("enabled", true);
  if (subscriptionsError) return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });

  const due = ((allSubscriptions || []) as SubscriptionRow[]).filter((subscription) => {
    const delta = minutes - targetMinutes(subscription.notification_time);
    return delta >= 0 && delta < 10;
  });
  if (!due.length) return NextResponse.json({ checked: 0, sent: 0 });

  const subscriptionIds = due.map((item) => item.id);
  const { data: sentRows } = await supabase
    .from("push_delivery_log")
    .select("subscription_id")
    .in("subscription_id", subscriptionIds)
    .eq("delivery_date", dateKey)
    .eq("delivery_kind", "daily_calendar");
  const alreadySent = new Set((sentRows || []).map((row) => row.subscription_id));
  const pending = due.filter((item) => !alreadySent.has(item.id));
  if (!pending.length) return NextResponse.json({ checked: due.length, sent: 0 });

  const profileIds = Array.from(new Set(pending.map((item) => item.profile_id)));
  const environmentByProfile = new Map(pending.map((item) => [item.profile_id, item.crm_environment]));

  const taskMap = new Map<string, Task[]>();
  for (const profileId of profileIds) {
    const environment = environmentByProfile.get(profileId) || "production";
    const [{ data: callbackRows }, { data: meetingRows }, { data: internalRows }] = await Promise.all([
      supabase.from("leads")
        .select("id,full_name,callback_at")
        .eq("crm_environment", environment)
        .eq("assigned_to", profileId)
        .not("callback_at", "is", null)
        .limit(1500),
      supabase.from("leads")
        .select("id,full_name,meeting_at")
        .eq("crm_environment", environment)
        .eq("assigned_to", profileId)
        .not("meeting_at", "is", null)
        .limit(1500),
      supabase.from("calendar_events")
        .select("id,title,starts_at")
        .eq("crm_environment", environment)
        .eq("owner_id", profileId)
        .limit(1000)
    ]);

    const tasks: Task[] = [];
    for (const lead of callbackRows || []) {
      if (lead.callback_at && dateKeyWarsaw(lead.callback_at) === dateKey) {
        tasks.push({ at: lead.callback_at, label: "Call back", name: lead.full_name, url: `/leads/${lead.id}?returnTo=%2Fcalendar` });
      }
    }
    for (const lead of meetingRows || []) {
      if (lead.meeting_at && dateKeyWarsaw(lead.meeting_at) === dateKey) {
        tasks.push({ at: lead.meeting_at, label: "Spotkanie", name: lead.full_name, url: `/leads/${lead.id}?returnTo=%2Fcalendar` });
      }
    }
    for (const event of internalRows || []) {
      if (event.starts_at && dateKeyWarsaw(event.starts_at) === dateKey) {
        tasks.push({ at: event.starts_at, label: "Inne", name: event.title, url: "/calendar" });
      }
    }
    tasks.sort((a, b) => a.at.localeCompare(b.at));
    taskMap.set(profileId, tasks);
  }

  let sent = 0;
  let disabled = 0;
  const failures: string[] = [];
  for (const subscription of pending) {
    const tasks = taskMap.get(subscription.profile_id) || [];
    const summary = taskSummary(tasks);
    try {
      if (tasks.length) {
        const result = await sendWebPush(
          { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
          {
            title: summary.title,
            body: summary.body,
            url: "/calendar",
            tag: `bcrm-calendar-${dateKey}`
          },
          {
            publicKey: config.vapid_public_key,
            privateJwk: config.vapid_private_jwk,
            subject: config.vapid_subject
          }
        );
        if (!result.ok) {
          if (result.status === 404 || result.status === 410) {
            await supabase.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", subscription.id);
            disabled += 1;
          } else {
            failures.push(`${subscription.id}: HTTP ${result.status}`);
            continue;
          }
        } else {
          sent += 1;
        }
      }

      await supabase.from("push_delivery_log").upsert({
        subscription_id: subscription.id,
        delivery_date: dateKey,
        delivery_kind: "daily_calendar",
        sent_at: new Date().toISOString()
      }, { onConflict: "subscription_id,delivery_date,delivery_kind" });
    } catch (error) {
      failures.push(`${subscription.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json({ checked: due.length, pending: pending.length, sent, disabled, failures });
}

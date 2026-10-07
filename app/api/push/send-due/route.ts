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

type ReminderTask = {
  id: string;
  at: string;
  kind: "meeting" | "callback";
  name: string;
  url: string;
};

type ProfileSchedule = {
  tasks: ReminderTask[];
  pendingMeetingNotes: number;
};

const REMINDER_OFFSETS = [60, 30, 5] as const;
const REMINDER_WINDOW_MINUTES = 3;

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

function plCount(count: number, one: string, few: string, many: string) {
  if (count === 1) return `1 ${one}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

function dailySummary(schedule: ProfileSchedule) {
  const meetings = schedule.tasks.filter((task) => task.kind === "meeting").length;
  const callbacks = schedule.tasks.filter((task) => task.kind === "callback").length;
  const parts = [
    meetings ? plCount(meetings, "spotkanie", "spotkania", "spotkań") : "",
    callbacks ? plCount(callbacks, "callback", "callbacki", "callbacków") : "",
    schedule.pendingMeetingNotes ? `${plCount(schedule.pendingMeetingNotes, "notatka", "notatki", "notatek")} po spotkaniach do uzupełnienia` : ""
  ].filter(Boolean);

  if (!parts.length) return null;
  return {
    title: "B-CRM · plan na dziś",
    body: parts.join(" · ")
  };
}

function reminderOffset(task: ReminderTask, nowMs: number) {
  const atMs = new Date(task.at).getTime();
  if (!Number.isFinite(atMs)) return null;
  const minutesUntil = (atMs - nowMs) / 60_000;
  return REMINDER_OFFSETS.find((offset) => Math.abs(minutesUntil - offset) < REMINDER_WINDOW_MINUTES) ?? null;
}

function reminderCopy(task: ReminderTask, offset: number) {
  const label = task.kind === "meeting" ? "Spotkanie" : "Callback";
  return {
    title: `${label} za ${offset} min`,
    body: `${timeWarsaw(task.at)} · ${task.name}`
  };
}

function profileKey(profileId: string, environment: string) {
  return `${profileId}:${environment}`;
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

  const now = new Date();
  const nowMs = now.getTime();
  const { dateKey, minutes } = warsawParts(now);
  const { data: allSubscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id,profile_id,crm_environment,endpoint,p256dh,auth,notification_time")
    .eq("enabled", true);
  if (subscriptionsError) return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });

  const subscriptions = (allSubscriptions || []) as SubscriptionRow[];
  if (!subscriptions.length) return NextResponse.json({ checked: 0, sent: 0 });

  const scheduleMap = new Map<string, ProfileSchedule>();
  const uniqueProfiles = Array.from(
    new Map(subscriptions.map((item) => [profileKey(item.profile_id, item.crm_environment), item])).values()
  );

  for (const subscription of uniqueProfiles) {
    const [{ data: callbackRows }, { data: meetingRows }] = await Promise.all([
      supabase.from("leads")
        .select("id,full_name,status,callback_at")
        .eq("crm_environment", subscription.crm_environment)
        .eq("assigned_to", subscription.profile_id)
        .eq("status", "Call back")
        .not("callback_at", "is", null)
        .limit(1500),
      supabase.from("leads")
        .select("id,full_name,status,meeting_at")
        .eq("crm_environment", subscription.crm_environment)
        .eq("assigned_to", subscription.profile_id)
        .eq("status", "Spotkanie")
        .not("meeting_at", "is", null)
        .limit(1500)
    ]);

    const tasks: ReminderTask[] = [];
    for (const lead of callbackRows || []) {
      if (lead.callback_at && dateKeyWarsaw(lead.callback_at) === dateKey) {
        tasks.push({
          id: lead.id,
          at: lead.callback_at,
          kind: "callback",
          name: lead.full_name,
          url: `/leads/${lead.id}?returnTo=%2Fcalendar`
        });
      }
    }
    for (const lead of meetingRows || []) {
      if (lead.meeting_at && dateKeyWarsaw(lead.meeting_at) === dateKey) {
        tasks.push({
          id: lead.id,
          at: lead.meeting_at,
          kind: "meeting",
          name: lead.full_name,
          url: `/leads/${lead.id}?returnTo=%2Fcalendar`
        });
      }
    }
    tasks.sort((a, b) => a.at.localeCompare(b.at));

    const pendingMeetingNotes = (meetingRows || []).filter((lead) => {
      if (!lead.meeting_at) return false;
      const meetingMs = new Date(lead.meeting_at).getTime();
      return Number.isFinite(meetingMs) && meetingMs < nowMs;
    }).length;

    scheduleMap.set(profileKey(subscription.profile_id, subscription.crm_environment), {
      tasks,
      pendingMeetingNotes
    });
  }

  const subscriptionIds = subscriptions.map((item) => item.id);
  const { data: sentRows } = await supabase
    .from("push_delivery_log")
    .select("subscription_id,delivery_kind")
    .in("subscription_id", subscriptionIds)
    .eq("delivery_date", dateKey);
  const alreadySent = new Set((sentRows || []).map((row) => `${row.subscription_id}:${row.delivery_kind}`));

  let sent = 0;
  let disabled = 0;
  let dailySent = 0;
  let reminderSent = 0;
  const failures: string[] = [];

  async function deliver(
    subscription: SubscriptionRow,
    payload: { title: string; body: string; url: string; tag: string },
    deliveryKind: string
  ) {
    const logKey = `${subscription.id}:${deliveryKind}`;
    if (alreadySent.has(logKey)) return false;

    try {
      const result = await sendWebPush(
        { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
        payload,
        {
          publicKey: config.vapid_public_key,
          privateJwk: config.vapid_private_jwk,
          subject: config.vapid_subject
        }
      );

      if (!result.ok) {
        if (result.status === 404 || result.status === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
          disabled += 1;
        } else {
          failures.push(`${subscription.id}: HTTP ${result.status}`);
        }
        return false;
      }

      const { error: logError } = await supabase.from("push_delivery_log").upsert({
        subscription_id: subscription.id,
        delivery_date: dateKey,
        delivery_kind: deliveryKind,
        sent_at: new Date().toISOString()
      }, { onConflict: "subscription_id,delivery_date,delivery_kind" });
      if (logError) failures.push(`${subscription.id}: ${logError.message}`);

      alreadySent.add(logKey);
      sent += 1;
      return true;
    } catch (error) {
      failures.push(`${subscription.id}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  for (const subscription of subscriptions) {
    const schedule = scheduleMap.get(profileKey(subscription.profile_id, subscription.crm_environment)) || {
      tasks: [],
      pendingMeetingNotes: 0
    };

    const dailyDelta = minutes - targetMinutes(subscription.notification_time);
    const dailyDue = dailyDelta >= 0 && dailyDelta < 5;
    const dailyKind = "daily_calendar";

    if (dailyDue && !alreadySent.has(`${subscription.id}:${dailyKind}`)) {
      const summary = dailySummary(schedule);
      if (summary) {
        const ok = await deliver(
          subscription,
          {
            title: summary.title,
            body: summary.body,
            url: "/calendar",
            tag: `bcrm-daily-${dateKey}`
          },
          dailyKind
        );
        if (ok) dailySent += 1;
      } else {
        await supabase.from("push_delivery_log").upsert({
          subscription_id: subscription.id,
          delivery_date: dateKey,
          delivery_kind: dailyKind,
          sent_at: new Date().toISOString()
        }, { onConflict: "subscription_id,delivery_date,delivery_kind" });
        alreadySent.add(`${subscription.id}:${dailyKind}`);
      }
    }

    for (const task of schedule.tasks) {
      const offset = reminderOffset(task, nowMs);
      if (!offset) continue;

      const deliveryKind = `reminder_${task.kind}_${task.id}_${offset}`;
      if (alreadySent.has(`${subscription.id}:${deliveryKind}`)) continue;
      const copy = reminderCopy(task, offset);
      const ok = await deliver(
        subscription,
        {
          title: copy.title,
          body: copy.body,
          url: task.url,
          tag: `bcrm-${task.kind}-${task.id}-${offset}-${dateKey}`
        },
        deliveryKind
      );
      if (ok) reminderSent += 1;
    }
  }

  return NextResponse.json({
    checked: subscriptions.length,
    sent,
    dailySent,
    reminderSent,
    disabled,
    failures
  });
}

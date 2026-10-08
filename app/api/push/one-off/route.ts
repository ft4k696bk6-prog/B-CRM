import { NextResponse } from "next/server";
import { sendEventPushToProfiles } from "@/lib/push-events";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

type OneOffPushBody = {
  recipientIds?: string[];
  title?: string;
  body?: string;
};

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const { supabaseAdmin, profile } = auth;
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Tylko właściciel może wysyłać jednorazowe powiadomienia." }, { status: 403 });
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("crm_environment", profile.crm_environment)
    .order("full_name", { ascending: true });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const profileIds = (profiles || []).map((person) => person.id);
  let pushCounts = new Map<string, number>();

  if (profileIds.length) {
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("profile_id")
      .eq("crm_environment", profile.crm_environment)
      .eq("enabled", true)
      .in("profile_id", profileIds);

    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    pushCounts = new Map<string, number>();
    for (const subscription of subscriptions || []) {
      pushCounts.set(subscription.profile_id, (pushCounts.get(subscription.profile_id) || 0) + 1);
    }
  }

  return NextResponse.json({
    recipients: (profiles || []).map((person) => ({
      id: person.id,
      full_name: person.full_name,
      email: person.email,
      role: person.role,
      activePushDevices: pushCounts.get(person.id) || 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const { supabaseAdmin, profile } = auth;
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Tylko właściciel może wysyłać jednorazowe powiadomienia." }, { status: 403 });
  }

  let payload: OneOffPushBody;
  try {
    payload = (await request.json()) as OneOffPushBody;
  } catch {
    return NextResponse.json({ error: "Niepoprawne dane powiadomienia." }, { status: 400 });
  }

  const title = normalizeText(payload.title, 80) || "B-CRM";
  const body = normalizeText(payload.body, 500);
  const requestedRecipientIds = Array.isArray(payload.recipientIds)
    ? [...new Set(payload.recipientIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 50)
    : [];

  if (!body) {
    return NextResponse.json({ error: "Wpisz treść powiadomienia." }, { status: 400 });
  }
  if (!requestedRecipientIds.length) {
    return NextResponse.json({ error: "Wybierz co najmniej jednego odbiorcę." }, { status: 400 });
  }

  const { data: allowedProfiles, error: recipientsError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("crm_environment", profile.crm_environment)
    .in("id", requestedRecipientIds);

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }

  const recipientIds = (allowedProfiles || []).map((person) => person.id);
  if (!recipientIds.length) {
    return NextResponse.json({ error: "Nie znaleziono odbiorców w tym środowisku CRM." }, { status: 404 });
  }

  const delivery = await sendEventPushToProfiles(
    supabaseAdmin,
    profile.crm_environment,
    recipientIds,
    {
      title,
      body,
      url: "/",
      tag: `bcrm-owner-oneoff-${profile.id}-${Date.now()}`,
    },
  );

  return NextResponse.json({
    recipients: recipientIds.length,
    sentDevices: delivery.sent,
    disabledDevices: delivery.disabled,
  });
}

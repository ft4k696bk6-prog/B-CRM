import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

type PushBody = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
  notification_time?: unknown;
  enabled?: unknown;
};

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const [{ data: config, error: configError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    auth.supabaseAdmin.from("push_config").select("vapid_public_key").eq("id", "default").maybeSingle(),
    auth.supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint,notification_time,enabled")
      .eq("profile_id", auth.profile.id)
      .eq("crm_environment", auth.profile.crm_environment)
  ]);

  if (configError || !config?.vapid_public_key) {
    return NextResponse.json({ error: "Powiadomienia push nie są skonfigurowane." }, { status: 503 });
  }
  if (subscriptionsError) {
    return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
  }

  return NextResponse.json({
    publicKey: config.vapid_public_key,
    subscriptions: (subscriptions || []).map((item) => ({
      endpoint: item.endpoint,
      enabled: item.enabled,
      notification_time: String(item.notification_time || "").slice(0, 5)
    }))
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as PushBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.p256dh === "string" ? body.p256dh.trim() : "";
  const authKey = typeof body.auth === "string" ? body.auth.trim() : "";
  const notificationTime = typeof body.notification_time === "string" ? body.notification_time.trim() : "";
  const enabled = body.enabled !== false;

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("invalid endpoint");
  } catch {
    return NextResponse.json({ error: "Niepoprawne urządzenie push." }, { status: 400 });
  }

  if (!p256dh || !authKey) {
    return NextResponse.json({ error: "Brakuje kluczy urządzenia push." }, { status: 400 });
  }
  if (!validTime(notificationTime)) {
    return NextResponse.json({ error: "Wybierz godzinę codziennego podsumowania." }, { status: 400 });
  }

  const { error } = await auth.supabaseAdmin.from("push_subscriptions").upsert({
    profile_id: auth.profile.id,
    crm_environment: auth.profile.crm_environment,
    endpoint,
    p256dh,
    auth: authKey,
    notification_time: notificationTime,
    enabled,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, enabled, notification_time: notificationTime });
}

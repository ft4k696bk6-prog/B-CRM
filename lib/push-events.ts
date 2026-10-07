import { sendWebPush } from "@/lib/web-push";

type ServiceClient = ReturnType<typeof import("@/lib/server-auth").getServiceClient>;

type EventPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type SubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Best-effort event notification. A push failure must never roll back or block
 * the CRM action that caused it (assignment, settlement, etc.).
 */
export async function sendEventPushToProfiles(
  supabase: ServiceClient,
  crmEnvironment: string,
  profileIds: string[],
  payload: EventPushPayload,
) {
  const recipients = unique(profileIds);
  if (!recipients.length) return { sent: 0, disabled: 0 };

  try {
    const [{ data: config }, { data: subscriptionData, error: subscriptionsError }] = await Promise.all([
      supabase
        .from("push_config")
        .select("vapid_public_key,vapid_private_jwk,vapid_subject")
        .eq("id", "default")
        .maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("id,profile_id,endpoint,p256dh,auth")
        .eq("crm_environment", crmEnvironment)
        .eq("enabled", true)
        .in("profile_id", recipients),
    ]);

    if (subscriptionsError || !config) {
      if (subscriptionsError) console.error("Event push subscriptions:", subscriptionsError.message);
      return { sent: 0, disabled: 0 };
    }

    const subscriptions = (subscriptionData || []) as SubscriptionRow[];
    let sent = 0;
    let disabled = 0;

    for (const subscription of subscriptions) {
      try {
        const result = await sendWebPush(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
          payload,
          {
            publicKey: config.vapid_public_key,
            privateJwk: config.vapid_private_jwk,
            subject: config.vapid_subject,
          },
        );

        if (result.ok) {
          sent += 1;
          continue;
        }

        if (result.status === 404 || result.status === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
          disabled += 1;
        } else {
          console.error(`Event push ${subscription.id}: HTTP ${result.status}`);
        }
      } catch (error) {
        console.error("Event push delivery:", error);
      }
    }

    return { sent, disabled };
  } catch (error) {
    console.error("Event push:", error);
    return { sent: 0, disabled: 0 };
  }
}

export async function sendEventPushToRole(
  supabase: ServiceClient,
  crmEnvironment: string,
  role: string,
  payload: EventPushPayload,
) {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("crm_environment", crmEnvironment)
      .eq("role", role);

    if (error) {
      console.error("Event push role recipients:", error.message);
      return { sent: 0, disabled: 0 };
    }

    return sendEventPushToProfiles(
      supabase,
      crmEnvironment,
      (profiles || []).map((profile) => profile.id),
      payload,
    );
  } catch (error) {
    console.error("Event push role:", error);
    return { sent: 0, disabled: 0 };
  }
}

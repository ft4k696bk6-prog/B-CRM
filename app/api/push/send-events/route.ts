import { NextResponse } from "next/server";
import { sendEventPushToRole } from "@/lib/push-events";
import { getServiceClient } from "@/lib/server-auth";
import { hashPushSecret } from "@/lib/web-push";

export const runtime = "nodejs";
export const maxDuration = 120;

type QueueEvent = {
  id: string;
  contract_id: string;
  crm_environment: string;
  attempts: number;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get("x-bcrm-push-token") || url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 403 });

  const supabase = getServiceClient();
  const { data: config } = await supabase
    .from("push_config")
    .select("cron_token_hash")
    .eq("id", "default")
    .maybeSingle();

  if (!config || hashPushSecret(token) !== config.cron_token_hash) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 403 });
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_backoffice_push_events", {
    p_limit: 25,
  });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const events = (claimed || []) as QueueEvent[];
  let sentEvents = 0;
  let pendingEvents = 0;
  const failures: string[] = [];

  for (const event of events) {
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id,contract_number,customer_name,crm_environment")
      .eq("id", event.contract_id)
      .eq("crm_environment", event.crm_environment)
      .maybeSingle();

    if (contractError || !contract) {
      await supabase
        .from("backoffice_push_events")
        .update({
          processed_at: new Date().toISOString(),
          locked_at: null,
          last_error: contractError?.message || "Nie znaleziono umowy.",
        })
        .eq("id", event.id);
      failures.push(`${event.id}: brak umowy`);
      continue;
    }

    const delivery = await sendEventPushToRole(
      supabase,
      event.crm_environment,
      "backoffice",
      {
        title: "Nowe zgłoszenie do realizacji",
        body: `Umowa ${contract.contract_number} · ${contract.customer_name} została rozliczona. PGE i dotacja czekają w Zgłoszeniach.`,
        url: "/zgloszenia",
        tag: `bcrm-backoffice-settled-${event.id}`,
      },
    );

    if (delivery.sent > 0) {
      await supabase
        .from("backoffice_push_events")
        .update({
          processed_at: new Date().toISOString(),
          locked_at: null,
          last_error: null,
        })
        .eq("id", event.id);
      sentEvents += 1;
    } else {
      await supabase
        .from("backoffice_push_events")
        .update({
          locked_at: null,
          last_error: "Brak aktywnej subskrypcji push Back-Office albo dostawa push nie powiodła się.",
        })
        .eq("id", event.id);
      pendingEvents += 1;
    }
  }

  return NextResponse.json({
    claimed: events.length,
    sentEvents,
    pendingEvents,
    failures,
  });
}

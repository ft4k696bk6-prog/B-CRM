import crypto from "crypto";
import { NextResponse } from "next/server";
import { fetchMetaLeadgen, metaLeadgenToRawLead } from "@/lib/meta-lead-ads-sync";
import { ingestRawLeadRows } from "@/lib/server-lead-ingest";
import { getServiceClient } from "@/lib/server-auth";

type MetaWebhookBody = {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        leadgen_id?: string;
        form_id?: string;
        page_id?: string;
        ad_id?: string;
        created_time?: number;
      };
    }>;
  }>;
};

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function notifyManagers(input: { title: string; body: string; entityId?: string | null }) {
  const supabaseAdmin = getServiceClient();
  const { data: recipients } = await supabaseAdmin
    .from("profiles")
    .select("id,crm_environment,role")
    .in("role", ["owner", "admin", "kierownik", "menadzer", "manager"]);

  const rows = (recipients || []).map((profile) => ({
    recipient_id: profile.id,
    crm_environment: profile.crm_environment || "production",
    notification_type: "new_lead",
    title: input.title,
    body: input.body,
    entity_type: input.entityId ? "lead" : "meta_lead_ads",
    entity_id: input.entityId || null
  }));

  if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_LEAD_ADS_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Niepoprawna weryfikacja webhooka Meta." }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return NextResponse.json({ error: "Niepoprawny podpis Meta." }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as MetaWebhookBody;
    const changes =
      body.entry?.flatMap((entry) => entry.changes || []).filter((change) => change.field === "leadgen" && change.value?.leadgen_id) || [];

    const supabaseAdmin = getServiceClient();
    const imported: string[] = [];
    const skipped: string[] = [];

    for (const change of changes) {
      const value = change.value!;
      const details = await fetchMetaLeadgen(value.leadgen_id!);

      if (!details.data?.field_data) {
        skipped.push(value.leadgen_id!);
        await notifyManagers({
          title: "Nowy lead z Meta bez pobranych danych",
          body: details.error || "Webhook działa, ale brakuje tokenu lub zgody do pobrania danych leadgen_id."
        }).catch(() => undefined);
        continue;
      }

      const rawLead = metaLeadgenToRawLead(details.data, {
        leadgenId: value.leadgen_id,
        formId: value.form_id,
        pageId: value.page_id
      });

      const result = await ingestRawLeadRows({
        supabaseAdmin,
        rows: [rawLead],
        source: "Meta Lead Ads",
        fileName: `meta-lead-${value.leadgen_id}`,
        crmEnvironment: "production"
      });

      if (result.error || result.imported === 0) {
        skipped.push(value.leadgen_id!);
        continue;
      }

      const leadId = result.importedIds[0];
      imported.push(leadId);
      await notifyManagers({
        title: "Nowy lead z Facebooka",
        body: "CRM odebrał lead z formularza Re-Energy System.",
        entityId: leadId
      }).catch(() => undefined);
    }

    return NextResponse.json({ imported: imported.length, skipped: skipped.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd webhooka Meta." },
      { status: 500 }
    );
  }
}

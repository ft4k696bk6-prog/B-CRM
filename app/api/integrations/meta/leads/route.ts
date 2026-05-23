import crypto from "crypto";
import { NextResponse } from "next/server";
import { normalizeLeadImportRow, normalizeEmailKey, normalizePhoneKey } from "@/lib/lead-import";
import { getServiceClient } from "@/lib/server-auth";

type MetaLeadField = {
  name: string;
  values?: string[];
};

type MetaLeadgenPayload = {
  id?: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  form_id?: string;
  page_id?: string;
  ad_id?: string;
};

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
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function fieldValue(fields: MetaLeadField[] | undefined, names: string[]) {
  const normalizedNames = names.map((name) => name.toLowerCase());
  const match = fields?.find((field) => normalizedNames.includes(field.name.toLowerCase()));
  return match?.values?.[0] || "";
}

async function fetchLeadgen(leadgenId: string) {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_LEAD_ADS_ACCESS_TOKEN;
  if (!accessToken) return null;

  const version = process.env.META_GRAPH_VERSION || "v20.0";
  const url = new URL(`https://graph.facebook.com/${version}/${leadgenId}`);
  url.searchParams.set("fields", "created_time,field_data,form_id,page_id,ad_id");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) return null;
  return (await response.json()) as MetaLeadgenPayload;
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
      const details = await fetchLeadgen(value.leadgen_id!);

      if (!details?.field_data) {
        skipped.push(value.leadgen_id!);
        await notifyManagers({
          title: "Nowy lead z Meta bez pobranych danych",
          body: "Webhook działa, ale brakuje tokenu lub zgody do pobrania danych leadgen_id."
        }).catch(() => undefined);
        continue;
      }

      const rawLead = {
        full_name: fieldValue(details.field_data, ["full_name", "name", "first_name", "last_name"]),
        phone: fieldValue(details.field_data, ["phone_number", "phone", "telefon"]),
        email: fieldValue(details.field_data, ["email", "e-mail"]),
        source: "Meta Lead Ads",
        status: "Nowy",
        created_at: details.created_time,
        comment: `Meta Lead Ads: form_id=${details.form_id || value.form_id || "unknown"}`
      };
      const normalized = normalizeLeadImportRow(rawLead);

      if (!normalized.ok) {
        skipped.push(value.leadgen_id!);
        continue;
      }

      const phoneKey = normalized.row.dedupe_key.startsWith("phone:") ? normalized.row.dedupe_key : normalizePhoneKey(normalized.row.phone);
      const emailKey = normalizeEmailKey(normalized.row.email);

      const duplicateByPhone = phoneKey
        ? await supabaseAdmin.from("leads").select("id").eq("crm_environment", "production").eq("phone_key", phoneKey).maybeSingle()
        : { data: null };
      const duplicateByEmail = emailKey
        ? await supabaseAdmin.from("leads").select("id").eq("crm_environment", "production").eq("email_key", emailKey).maybeSingle()
        : { data: null };

      if (duplicateByPhone.data?.id || duplicateByEmail.data?.id) {
        skipped.push(value.leadgen_id!);
        continue;
      }

      const { data: lead, error } = await supabaseAdmin
        .from("leads")
        .insert({
          full_name: normalized.row.full_name,
          phone: normalized.row.phone,
          email: normalized.row.email,
          phone_key: phoneKey || null,
          email_key: emailKey || null,
          postal_code: normalized.row.postal_code,
          address: normalized.row.address,
          voivodeship: normalized.row.voivodeship,
          county: normalized.row.county,
          source: "Meta Lead Ads",
          status: "Nowy",
          assigned_to: null,
          crm_environment: "production"
        })
        .select("id")
        .single();

      if (error || !lead) {
        skipped.push(value.leadgen_id!);
        continue;
      }

      imported.push(lead.id);
      await supabaseAdmin.from("lead_history").insert({
        lead_id: lead.id,
        action_type: "meta_lead_ads",
        description: `Lead z formularza Meta. leadgen_id=${value.leadgen_id}`
      });
      await notifyManagers({
        title: "Nowy lead z Facebooka",
        body: "CRM odebrał lead z formularza Re-Energy System.",
        entityId: lead.id
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

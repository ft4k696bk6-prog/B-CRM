import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { CONTRACT_TASKS, FINANCING_OPTIONS, MOUNTING_OPTIONS, PRODUCT_OPTIONS } from "@/lib/contracts";
import { canManageLeads } from "@/lib/roles";

const contractSelect = "*,creator:profiles!contracts_created_by_fkey(id,full_name,email,manager_id),tasks:contract_tasks(*)";

type ContractRow = Record<string, unknown> & {
  id: string; lead_id: string; created_by: string; contract_number: string; customer_name: string;
  creator?: { manager_id?: string | null } | null; tasks?: Array<Record<string, unknown>>;
  installation_at?: string | null; updated_at?: string;
};

function text(body: Record<string, unknown>, key: string) { return typeof body[key] === "string" ? body[key].trim() : ""; }
function number(body: Record<string, unknown>, key: string) { const value = Number(body[key]); return Number.isFinite(value) ? value : null; }
function bool(body: Record<string, unknown>, key: string) { return body[key] === true; }

async function fallbackContracts(supabaseAdmin: ReturnType<typeof import("@/lib/server-auth").getServiceClient>, environment: string): Promise<ContractRow[]> {
  const { data: leadRows } = await supabaseAdmin.from("leads").select("id").eq("crm_environment", environment);
  const leadIds = (leadRows || []).map((lead) => lead.id);
  if (!leadIds.length) return [];
  const { data } = await supabaseAdmin.from("lead_history").select("lead_id,new_value,created_at").eq("action_type", "contract_record").in("lead_id", leadIds).order("created_at", { ascending: false });
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of data || []) if (!latest.has(row.lead_id) && row.new_value) latest.set(row.lead_id, row.new_value as Record<string, unknown>);
  const creatorIds = [...new Set([...latest.values()].map((item) => String(item.created_by || "")).filter(Boolean))];
  const { data: creators } = creatorIds.length ? await supabaseAdmin.from("profiles").select("id,full_name,email,manager_id").in("id", creatorIds) : { data: [] };
  return [...latest.values()].map((item) => ({ ...item, creator: (creators || []).find((person) => person.id === item.created_by) || null } as ContractRow));
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  const id = new URL(request.url).searchParams.get("id");
  let query = supabaseAdmin.from("contracts").select(contractSelect).eq("crm_environment", profile.crm_environment);
  if (id) query = query.eq("id", id);
  if (profile.role === "handlowiec") query = query.eq("created_by", profile.id);
  if (profile.role === "menadzer") {
    const { data: team } = await supabaseAdmin.from("profiles").select("id").or(`id.eq.${profile.id},manager_id.eq.${profile.id}`);
    query = query.in("created_by", (team || []).map((person) => person.id));
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error?.message?.includes("contracts")) {
    let contracts = await fallbackContracts(supabaseAdmin, profile.crm_environment);
    if (profile.role === "handlowiec") contracts = contracts.filter((contract) => contract.created_by === profile.id);
    if (profile.role === "menadzer") {
      const { data: team } = await supabaseAdmin.from("profiles").select("id").or(`id.eq.${profile.id},manager_id.eq.${profile.id}`);
      const ids = new Set((team || []).map((person) => person.id)); contracts = contracts.filter((contract) => ids.has(String(contract.created_by)));
    }
    if (id) contracts = contracts.filter((contract) => contract.id === id);
    return NextResponse.json(id ? { contract: contracts[0] || null } : { contracts });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(id ? { contract: data?.[0] || null } : { contracts: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  if (!canManageLeads(profile.role) && profile.role !== "handlowiec") return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const required = ["lead_id", "contract_number", "signed_at", "customer_name", "phone", "email", "postal_code", "city", "street", "house_number"];
  if (required.some((key) => !text(body, key))) return NextResponse.json({ error: "Uzupełnij wszystkie obowiązkowe dane klienta i umowy." }, { status: 400 });
  const financing = text(body, "financing"); const product = text(body, "product_type");
  if (!FINANCING_OPTIONS.some(([key]) => key === financing) || !PRODUCT_OPTIONS.includes(product as never)) return NextResponse.json({ error: "Niepoprawny produkt lub finansowanie." }, { status: 400 });
  const locations = Array.isArray(body.mounting_locations) ? body.mounting_locations.filter((x): x is string => typeof x === "string" && MOUNTING_OPTIONS.includes(x as never)) : [];
  if (!locations.length) return NextResponse.json({ error: "Wybierz miejsce montażu." }, { status: 400 });
  const leadId = text(body, "lead_id");
  const { data: lead } = await supabaseAdmin.from("leads").select("id,assigned_to,crm_environment").eq("id", leadId).eq("crm_environment", profile.crm_environment).single();
  if (!lead || (profile.role === "handlowiec" && lead.assigned_to !== profile.id)) return NextResponse.json({ error: "Nie masz dostępu do tego leada." }, { status: 403 });
  const payload = {
    lead_id: leadId, contract_number: text(body,"contract_number"), signed_at: text(body,"signed_at"), customer_name: text(body,"customer_name"),
    phone: text(body,"phone"), email: text(body,"email"), postal_code: text(body,"postal_code"), city: text(body,"city"), street: text(body,"street"), house_number: text(body,"house_number"),
    financing, credit_amount: financing === "gotowka" ? null : number(body,"credit_amount"), product_type: product,
    pv_power_kwp: product.includes("PV") ? number(body,"pv_power_kwp") : null, storage_capacity_kwh: product.includes("ME") ? number(body,"storage_capacity_kwh") : null,
    panel_power_wp: product.includes("PV") ? number(body,"panel_power_wp") : null, panels_count: product.includes("PV") ? number(body,"panels_count") : null,
    has_inverter: product !== "ME" || bool(body,"has_inverter"), inverter_power_kw: (product !== "ME" || bool(body,"has_inverter")) ? number(body,"inverter_power_kw") : null,
    mounting_locations: locations, multiple_mounting_locations: bool(body,"multiple_mounting_locations"), gross_amount: number(body,"gross_amount"),
    backup_power: bool(body,"backup_power"), optimizer_count: number(body,"optimizer_count") || 0, surge_protection: bool(body,"surge_protection"), grounding: bool(body,"grounding"),
    additional_notes: text(body,"additional_notes") || null, created_by: profile.id, crm_environment: profile.crm_environment
  };
  if (!payload.gross_amount || (product.includes("PV") && (!payload.pv_power_kwp || !payload.panels_count || !payload.panel_power_wp || !payload.inverter_power_kw)) || (product.includes("ME") && !payload.storage_capacity_kwh) || (financing !== "gotowka" && !payload.credit_amount)) return NextResponse.json({ error: "Uzupełnij wymagane moce, ilości oraz kwoty." }, { status: 400 });
  const insertResult = await supabaseAdmin.from("contracts").insert(payload).select().single();
  let contract = insertResult.data as ContractRow | null;
  let error = insertResult.error;
  if (error?.message?.includes("contracts")) {
    contract = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), installation_at: null, tasks: CONTRACT_TASKS.map(([task_key]) => ({ id: crypto.randomUUID(), contract_id: "", task_key, completed: false, completed_at: null, completed_by: null, updated_at: new Date().toISOString() })) };
    contract.tasks = contract.tasks?.map((task) => ({ ...task, contract_id: contract!.id }));
    const fallback = await supabaseAdmin.from("lead_history").insert({ lead_id: leadId, user_id: profile.id, action_type: "contract_record", description: `Zapisano umowę ${payload.contract_number}.`, new_value: contract });
    error = fallback.error;
  } else if (!error) {
    await supabaseAdmin.from("contract_tasks").insert(CONTRACT_TASKS.map(([task_key]) => ({ contract_id: contract!.id, task_key })));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: leadError } = await supabaseAdmin.from("leads").update({ status: "Umowa", assigned_to: null, contract_number: payload.contract_number, callback_at: null, meeting_at: null }).eq("id", leadId);
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 400 });
  return NextResponse.json({ contract }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth; const body = await request.json() as Record<string, unknown>; const id = text(body,"id");
  const dbResult = await supabaseAdmin.from("contracts").select("*,creator:profiles!contracts_created_by_fkey(manager_id),tasks:contract_tasks(*)").eq("id",id).eq("crm_environment",profile.crm_environment).single();
  let contract = dbResult.data as ContractRow | null;
  const fallbackMode = Boolean(dbResult.error?.message?.includes("contracts"));
  if (fallbackMode) contract = (await fallbackContracts(supabaseAdmin, profile.crm_environment)).find((item) => item.id === id) || null;
  if (!contract) return NextResponse.json({ error: "Nie znaleziono umowy." }, { status: 404 });
  const canEdit = ["owner","admin"].includes(profile.role) || (profile.role === "menadzer" && (contract.created_by === profile.id || contract.creator?.manager_id === profile.id));
  if (!canEdit) return NextResponse.json({ error: "Po zapisaniu umowę edytuje przełożony lub administrator." }, { status: 403 });
  if (text(body,"task_key")) {
    if (!["owner","admin"].includes(profile.role)) return NextResponse.json({ error: "Zadaniami realizacji zarządza administrator." }, { status: 403 });
    const taskKey = text(body,"task_key"); if (!CONTRACT_TASKS.some(([key]) => key === taskKey)) return NextResponse.json({ error: "Niepoprawne zadanie." }, { status: 400 });
    const completed = bool(body,"completed");
    if (fallbackMode) contract.tasks = (contract.tasks || []).map((task: Record<string, unknown>) => task.task_key === taskKey ? { ...task, completed, completed_at: completed ? new Date().toISOString() : null, completed_by: completed ? profile.id : null, updated_at: new Date().toISOString() } : task);
    else { await supabaseAdmin.from("contract_tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null, completed_by: completed ? profile.id : null, updated_at: new Date().toISOString() }).eq("contract_id",id).eq("task_key",taskKey); await supabaseAdmin.from("contract_task_history").insert({ contract_id:id, task_key:taskKey, completed, changed_by:profile.id }); }
  }
  if (Object.prototype.hasOwnProperty.call(body,"installation_at")) {
    const installationAt = text(body,"installation_at") || null;
    if (fallbackMode) { contract.installation_at = installationAt; contract.updated_at = new Date().toISOString(); }
    else await supabaseAdmin.from("contracts").update({ installation_at: installationAt, updated_at:new Date().toISOString() }).eq("id",id);
    if (installationAt) await supabaseAdmin.from("calendar_events").upsert({ id, title:`Montaż — ${contract.customer_name}`, description:`Umowa ${contract.contract_number}`, starts_at:installationAt, owner_id:profile.id, owner_role:profile.role, visibility:"internal", created_by:profile.id, crm_environment:profile.crm_environment });
  }
  if (body.contract_data && typeof body.contract_data === "object") {
    const source = body.contract_data as Record<string, unknown>;
    const editable = ["contract_number","signed_at","customer_name","phone","email","postal_code","city","street","house_number","financing","credit_amount","product_type","pv_power_kwp","storage_capacity_kwh","panel_power_wp","panels_count","has_inverter","inverter_power_kw","mounting_locations","multiple_mounting_locations","gross_amount","backup_power","optimizer_count","surge_protection","grounding","additional_notes"];
    const next = Object.fromEntries(editable.filter((key) => Object.prototype.hasOwnProperty.call(source,key)).map((key) => [key, source[key]]));
    if (fallbackMode) { Object.assign(contract,next); contract.updated_at = new Date().toISOString(); }
    else { const { error } = await supabaseAdmin.from("contracts").update({ ...next, updated_at:new Date().toISOString() }).eq("id",id); if(error)return NextResponse.json({error:error.message},{status:400}); }
  }
  if (fallbackMode) await supabaseAdmin.from("lead_history").insert({ lead_id: contract.lead_id, user_id: profile.id, action_type: "contract_record", description: `Zaktualizowano umowę ${contract.contract_number}.`, new_value: contract });
  return GET(new Request(`${new URL(request.url).origin}/api/contracts?id=${id}`, { headers: request.headers }));
}

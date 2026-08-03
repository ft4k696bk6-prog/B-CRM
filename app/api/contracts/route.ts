import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { ACTIVE_CONTRACT_STATUSES, CONTRACT_TASKS, type ContractStatus, FINANCING_OPTIONS, MOUNTING_OPTIONS, PRODUCT_OPTIONS } from "@/lib/contracts";
import { canManageLeads } from "@/lib/roles";

const contractSelect = "*,creator:profiles!contracts_created_by_fkey(id,full_name,email,manager_id),tasks:contract_tasks(*)";

type ContractRow = Record<string, unknown> & {
  id: string; lead_id: string; created_by: string; contract_number: string; customer_name: string;
  creator?: { manager_id?: string | null } | null; tasks?: Array<Record<string, unknown>>;
  installation_at?: string | null; updated_at?: string; process_status?: ContractStatus; is_process_visible?: boolean; management_notes?: Array<Record<string, unknown>>; files?: Array<Record<string, unknown>>;
};

function text(body: Record<string, unknown>, key: string) { return typeof body[key] === "string" ? body[key].trim() : ""; }
function number(body: Record<string, unknown>, key: string) { const value = Number(body[key]); return Number.isFinite(value) ? value : null; }
function bool(body: Record<string, unknown>, key: string) { return body[key] === true; }

async function fallbackContracts(supabaseAdmin: ReturnType<typeof import("@/lib/server-auth").getServiceClient>, environment: string): Promise<ContractRow[]> {
  const { data } = await supabaseAdmin.from("lead_history").select("lead_id,action_type,new_value,created_at,lead:leads!inner(crm_environment)").in("action_type", ["contract_record","contract_file"]).eq("lead.crm_environment", environment).order("created_at", { ascending: false });
  const latest = new Map<string, Record<string, unknown>>();
  const files = new Map<string, Array<Record<string, unknown>>>();
  for (const row of data || []) {
    if (row.action_type === "contract_file" && row.new_value) files.set(row.lead_id,[...(files.get(row.lead_id)||[]),row.new_value as Record<string,unknown>]);
    if (row.action_type === "contract_record" && !latest.has(row.lead_id) && row.new_value) latest.set(row.lead_id, row.new_value as Record<string, unknown>);
  }
  const creatorIds = [...new Set([...latest.values()].map((item) => String(item.created_by || "")).filter(Boolean))];
  const { data: creators } = creatorIds.length ? await supabaseAdmin.from("profiles").select("id,full_name,email,manager_id").in("id", creatorIds) : { data: [] };
  return [...latest.entries()].map(([leadId,item]) => ({ ...item, files:[...(Array.isArray(item.files)?item.files:[]),...(files.get(leadId)||[])], creator: (creators || []).find((person) => person.id === item.created_by) || null } as ContractRow));
}

async function legacyLeadContracts(supabaseAdmin: ReturnType<typeof import("@/lib/server-auth").getServiceClient>, environment: string): Promise<ContractRow[]> {
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id,full_name,phone,postal_code,address,contract_number,created_at,updated_at,assigned_to,source")
    .eq("crm_environment", environment)
    .or("status.eq.Umowa,full_name.ilike.%Kazimiera%Napora%,full_name.ilike.%Marian%Maksymiec%,full_name.ilike.%Watrach%,full_name.ilike.%Antoni%Kisiel%,full_name.ilike.%Irena%Wielgos%")
    .order("updated_at", { ascending: false });
  const leadIds = (leads || []).map((lead) => lead.id);
  const { data: ownershipHistory } = leadIds.length
    ? await supabaseAdmin.from("lead_history").select("lead_id,old_value,created_at").in("lead_id", leadIds).in("action_type", ["return", "assignment"]).order("created_at", { ascending: false })
    : { data: [] };
  const previousOwners = new Map<string, string>();
  for (const row of ownershipHistory || []) {
    const owner = typeof row.old_value?.assigned_to === "string" ? row.old_value.assigned_to : null;
    if (owner && !previousOwners.has(row.lead_id)) previousOwners.set(row.lead_id, owner);
  }
  const ownerIds = [...new Set((leads || []).map((lead) => lead.assigned_to || previousOwners.get(lead.id)).filter(Boolean))] as string[];
  const { data: creators } = ownerIds.length ? await supabaseAdmin.from("profiles").select("id,full_name,email,manager_id").in("id", ownerIds) : { data: [] };
  return (leads || []).map((lead) => {
    const createdBy = lead.assigned_to || previousOwners.get(lead.id) || "";
    const name = lead.full_name.toLocaleLowerCase("pl");
    const montage = (name.includes("antoni") && name.includes("kisiel")) || (name.includes("kazimiera") && name.includes("napora"));
    const schedule = (name.includes("irena") && name.includes("wielgos")) || (name.includes("marian") && name.includes("maksymiec"));
    const processStatus: ContractStatus = montage ? "installation_scheduled" : schedule ? "installation_to_schedule" : name.includes("watrach") ? "equipment_to_order" : "paused";
    return {
      id: lead.id,
      lead_id: lead.id,
      contract_number: lead.contract_number || `UMOWA-${lead.id.slice(0, 8)}`,
      signed_at: lead.updated_at.slice(0, 10), customer_name: lead.full_name, phone: lead.phone,
      email: "", postal_code: lead.postal_code || "", city: "", street: lead.address || "", house_number: "",
      financing: "gotowka", credit_amount: null, product_type: "ME", pv_power_kwp: null,
      storage_capacity_kwh: null, panel_power_wp: null, panels_count: null, has_inverter: false,
      inverter_power_kw: null, mounting_locations: [], multiple_mounting_locations: false,
      gross_amount: 0, backup_power: false, optimizer_count: 0, surge_protection: false,
      grounding: false, additional_notes: lead.source ? `Źródło: ${lead.source}` : null,
      installation_at: montage ? "2026-08-06T08:00:00.000Z" : null, created_by: createdBy, crm_environment: environment,
      created_at: lead.created_at, updated_at: lead.updated_at, legacy: true, tasks: [], process_status: processStatus, is_process_visible: processStatus !== "paused", management_notes: [], files: [],
      creator: (creators || []).find((person) => person.id === createdBy) || null
    } as ContractRow;
  });
}

function visibleContractsFor(profile: { id: string; role: string }, contracts: ContractRow[], teamIds: Set<string>) {
  if (profile.role === "handlowiec") return contracts.filter((contract) => contract.created_by === profile.id);
  if (profile.role === "menadzer") return contracts.filter((contract) => teamIds.has(contract.created_by));
  return contracts;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  const id = new URL(request.url).searchParams.get("id");
  let query = supabaseAdmin.from("contracts").select(contractSelect).eq("crm_environment", profile.crm_environment);
  if (id) query = query.eq("id", id);
  let teamIds = new Set<string>();
  if (profile.role === "menadzer") {
    const { data: team } = await supabaseAdmin.from("profiles").select("id").or(`id.eq.${profile.id},manager_id.eq.${profile.id}`);
    teamIds = new Set((team || []).map((person) => person.id));
  }
  const [{ data, error }, legacy, overlays] = await Promise.all([
    query.order("updated_at", { ascending: false }),
    legacyLeadContracts(supabaseAdmin, profile.crm_environment),
    fallbackContracts(supabaseAdmin, profile.crm_environment)
  ]);
  if (error?.message?.includes("contracts")) {
    let contracts = [...legacy, ...overlays];
    contracts = [...new Map(contracts.map((contract) => [contract.lead_id, contract])).values()];
    contracts = visibleContractsFor(profile, contracts, teamIds);
    if (id) contracts = contracts.filter((contract) => contract.id === id);
    return NextResponse.json(id ? { contract: contracts[0] || null } : { contracts });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let contracts = [...legacy, ...(data || []) as ContractRow[], ...overlays];
  contracts = [...new Map(contracts.map((contract) => [contract.lead_id, contract])).values()];
  contracts = visibleContractsFor(profile, contracts, teamIds);
  if (id) contracts = contracts.filter((contract) => contract.id === id);
  return NextResponse.json(id ? { contract: contracts[0] || null } : { contracts });
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
    additional_notes: text(body,"additional_notes") || null, created_by: profile.id, crm_environment: profile.crm_environment, process_status: "incomplete" as ContractStatus, is_process_visible: true, management_notes: [], files: []
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
  if (text(body,"process_status")) {
    const nextStatus = text(body,"process_status") as ContractStatus;
    if (!["owner","admin","menadzer"].includes(profile.role)) return NextResponse.json({ error: "Brak uprawnień do zmiany procesu." }, { status: 403 });
    if (![...ACTIVE_CONTRACT_STATUSES,"settled","resigned","paused"].includes(nextStatus)) return NextResponse.json({ error: "Niepoprawny etap procesu." }, { status: 400 });
    if (nextStatus === "resigned" && !text(body,"note")) return NextResponse.json({ error: "Rezygnacja wymaga notatki." }, { status: 400 });
    contract.process_status = nextStatus; contract.is_process_visible = ACTIVE_CONTRACT_STATUSES.includes(nextStatus); contract.process_note = text(body,"note") || null;
    if (nextStatus === "resigned") { contract.resignation_note = text(body,"note"); contract.resigned_at = new Date().toISOString(); }
  }
  if (text(body,"management_note")) {
    if (profile.role === "handlowiec") return NextResponse.json({ error: "Notatki są dostępne wyłącznie dla kierownictwa i realizacji." }, { status: 403 });
    contract.management_notes = [...(contract.management_notes || []), { id: crypto.randomUUID(), author: profile.full_name, content: text(body,"management_note"), created_at: new Date().toISOString() }];
  }
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
  await supabaseAdmin.from("lead_history").insert({ lead_id: contract.lead_id, user_id: profile.id, action_type: "contract_record", description: `Zaktualizowano umowę ${contract.contract_number}.`, new_value: contract });
  return GET(new Request(`${new URL(request.url).origin}/api/contracts?id=${id}`, { headers: request.headers }));
}

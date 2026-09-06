import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import {
  ACTIVE_CONTRACT_STATUSES,
  calculateCommission,
  canViewContractForRole,
  CONTRACT_TASKS,
  type ContractStatus,
  type ContractSubmissionStatus,
  FINANCING_OPTIONS,
  MOUNTING_OPTIONS,
  PRODUCT_OPTIONS,
} from "@/lib/contracts";

const contractSelect =
  "*,creator:profiles!contracts_created_by_fkey(id,full_name,email,manager_id),tasks:contract_tasks(*),files:contract_files(*)";

type ContractRow = Record<string, unknown> & {
  id: string;
  lead_id: string;
  created_by: string;
  contract_number: string;
  customer_name: string;
  creator?: { manager_id?: string | null } | null;
  tasks?: Array<Record<string, unknown>>;
  installation_at?: string | null;
  updated_at?: string;
  process_status?: ContractStatus;
  submission_status?: ContractSubmissionStatus;
  submitted_at?: string | null;
  is_process_visible?: boolean;
  management_notes?: Array<Record<string, unknown>>;
  files?: Array<Record<string, unknown>>;
};

function text(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}
function number(body: Record<string, unknown>, key: string) {
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : null;
}
function bool(body: Record<string, unknown>, key: string) {
  return body[key] === true;
}
function submissionStatusOf(contract: ContractRow): ContractSubmissionStatus {
  return (
    contract.submission_status ||
    (contract.process_status === "incomplete" ? "draft" : "submitted")
  );
}

function normalizeContract(contract: ContractRow): ContractRow {
  return {
    ...contract,
    submission_status: submissionStatusOf(contract),
    submitted_at: contract.submitted_at || null,
    files: (contract.files || []).map((file) => ({
      ...file,
      name: file.name || file.file_name,
      path: file.path || file.file_path,
      mime: file.mime || file.mime_type,
    })),
  };
}

/**
 * Emergency compatibility path for installations that still have historical
 * contract snapshots in lead_history. Production contract data itself must
 * come from the contracts table; no client-name based synthesis is allowed.
 */
async function fallbackContracts(
  supabaseAdmin: ReturnType<
    typeof import("@/lib/server-auth").getServiceClient
  >,
  environment: string,
): Promise<ContractRow[]> {
  const { data } = await supabaseAdmin
    .from("lead_history")
    .select(
      "lead_id,action_type,new_value,created_at,lead:leads!inner(crm_environment)",
    )
    .in("action_type", ["contract_record", "contract_file"])
    .eq("lead.crm_environment", environment)
    .order("created_at", { ascending: false });
  const latest = new Map<string, Record<string, unknown>>();
  const files = new Map<string, Array<Record<string, unknown>>>();
  for (const row of data || []) {
    if (row.action_type === "contract_file" && row.new_value)
      files.set(row.lead_id, [
        ...(files.get(row.lead_id) || []),
        row.new_value as Record<string, unknown>,
      ]);
    if (
      row.action_type === "contract_record" &&
      !latest.has(row.lead_id) &&
      row.new_value
    )
      latest.set(row.lead_id, row.new_value as Record<string, unknown>);
  }
  const creatorIds = [
    ...new Set(
      [...latest.values()]
        .map((item) => String(item.created_by || ""))
        .filter(Boolean),
    ),
  ];
  const { data: creators } = creatorIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id,full_name,email,manager_id")
        .in("id", creatorIds)
    : { data: [] };
  return [...latest.entries()].map(
    ([leadId, item]) =>
      ({
        ...item,
        files: [
          ...(Array.isArray(item.files) ? item.files : []),
          ...(files.get(leadId) || []),
        ],
        creator:
          (creators || []).find((person) => person.id === item.created_by) ||
          null,
      }) as ContractRow,
  );
}

function visibleContractsFor(
  profile: { id: string; role: string },
  contracts: ContractRow[],
  teamIds: Set<string>,
) {
  return contracts.filter((contract) =>
    canViewContractForRole({
      role: profile.role,
      profileId: profile.id,
      createdBy: contract.created_by,
      creatorManagerId: teamIds.has(contract.created_by)
        ? profile.id
        : contract.creator?.manager_id,
      submissionStatus: submissionStatusOf(contract),
    }),
  );
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  const id = new URL(request.url).searchParams.get("id");
  let query = supabaseAdmin
    .from("contracts")
    .select(contractSelect)
    .eq("crm_environment", profile.crm_environment);
  if (id) query = query.eq("id", id);
  let teamIds = new Set<string>();
  if (profile.role === "menadzer") {
    const { data: team } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`id.eq.${profile.id},manager_id.eq.${profile.id}`);
    teamIds = new Set((team || []).map((person) => person.id));
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error?.message?.includes("contracts")) {
    let contracts = await fallbackContracts(
      supabaseAdmin,
      profile.crm_environment,
    );
    contracts = visibleContractsFor(profile, contracts, teamIds);
    if (id) contracts = contracts.filter((contract) => contract.id === id);
    contracts = contracts.map(normalizeContract);
    return NextResponse.json(
      id ? { contract: contracts[0] || null } : { contracts },
    );
  }
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  let contracts = [...((data || []) as ContractRow[])];

  // An id miss may still be recoverable from a historical snapshot on an
  // installation that predates the contracts table migration. Lists on a
  // healthy installation always come exclusively from contracts.
  if (id && contracts.length === 0) {
    contracts = (await fallbackContracts(
      supabaseAdmin,
      profile.crm_environment,
    )).filter((contract) => contract.id === id);
  }

  contracts = [
    ...new Map(
      contracts.map((contract) => [contract.lead_id, contract]),
    ).values(),
  ];
  contracts = visibleContractsFor(profile, contracts, teamIds);
  if (id) contracts = contracts.filter((contract) => contract.id === id);
  contracts = contracts.map(normalizeContract);
  return NextResponse.json(
    id ? { contract: contracts[0] || null } : { contracts },
  );
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  if (!["owner", "admin", "handlowiec"].includes(profile.role))
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const body = (await request.json()) as Record<string, unknown>;
  const required = [
    "lead_id",
    "contract_number",
    "signed_at",
    "customer_name",
    "phone",
    "email",
    "postal_code",
    "city",
    "street",
    "house_number",
  ];
  if (required.some((key) => !text(body, key)))
    return NextResponse.json(
      { error: "Uzupełnij wszystkie obowiązkowe dane klienta i umowy." },
      { status: 400 },
    );
  const financing = text(body, "financing");
  const product = text(body, "product_type");
  if (
    !FINANCING_OPTIONS.some(([key]) => key === financing) ||
    !PRODUCT_OPTIONS.includes(product as never)
  )
    return NextResponse.json(
      { error: "Niepoprawny produkt lub finansowanie." },
      { status: 400 },
    );
  const rawLocations = Array.isArray(body.mounting_locations)
    ? body.mounting_locations
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const locations =
    product === "ME"
      ? rawLocations.slice(0, 1).map((value) => value.slice(0, 160))
      : rawLocations.filter((value) =>
          MOUNTING_OPTIONS.includes(value as never),
        );
  if (!locations.length)
    return NextResponse.json(
      {
        error:
          product === "ME"
            ? "Wpisz miejsce montażu magazynu energii."
            : "Wybierz miejsce montażu instalacji PV.",
      },
      { status: 400 },
    );
  const leadId = text(body, "lead_id");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id,assigned_to,crm_environment")
    .eq("id", leadId)
    .eq("crm_environment", profile.crm_environment)
    .single();
  if (
    !lead ||
    (profile.role === "handlowiec" && lead.assigned_to !== profile.id)
  )
    return NextResponse.json(
      { error: "Nie masz dostępu do tego leada." },
      { status: 403 },
    );
  const { data: creatorPricing } = await supabaseAdmin
    .from("profiles")
    .select("sales_margin_net,commission_percent")
    .eq("id", profile.id)
    .single();
  const commissionMarginNet = Number(creatorPricing?.sales_margin_net) || 0;
  const commissionPercent = Number(creatorPricing?.commission_percent) || 0;
  const payload = {
    lead_id: leadId,
    contract_number: text(body, "contract_number"),
    signed_at: text(body, "signed_at"),
    customer_name: text(body, "customer_name"),
    phone: text(body, "phone"),
    email: text(body, "email"),
    postal_code: text(body, "postal_code"),
    city: text(body, "city"),
    street: text(body, "street"),
    house_number: text(body, "house_number"),
    financing,
    credit_amount:
      financing === "gotowka" ? null : number(body, "credit_amount"),
    product_type: product,
    pv_power_kwp: product.includes("PV") ? number(body, "pv_power_kwp") : null,
    storage_capacity_kwh: product.includes("ME")
      ? number(body, "storage_capacity_kwh")
      : null,
    panel_power_wp: product.includes("PV")
      ? number(body, "panel_power_wp")
      : null,
    panels_count: product.includes("PV") ? number(body, "panels_count") : null,
    has_inverter: product !== "ME" || bool(body, "has_inverter"),
    inverter_power_kw:
      product !== "ME" || bool(body, "has_inverter")
        ? number(body, "inverter_power_kw")
        : null,
    mounting_locations: locations,
    multiple_mounting_locations: bool(body, "multiple_mounting_locations"),
    gross_amount: number(body, "gross_amount"),
    backup_power: bool(body, "backup_power"),
    optimizer_count: number(body, "optimizer_count") || 0,
    surge_protection: bool(body, "surge_protection"),
    grounding: bool(body, "grounding"),
    additional_notes: text(body, "additional_notes") || null,
    created_by: profile.id,
    crm_environment: profile.crm_environment,
    submission_status: "draft" as ContractSubmissionStatus,
    submitted_at: null,
    process_status: "incomplete" as ContractStatus,
    is_process_visible: false,
    management_notes: [],
    commission_margin_net: commissionMarginNet,
    commission_percent: commissionPercent,
    commission_amount: calculateCommission(
      commissionMarginNet,
      commissionPercent,
    ),
  };
  if (
    !payload.gross_amount ||
    (product.includes("PV") &&
      (!payload.pv_power_kwp ||
        !payload.panels_count ||
        !payload.panel_power_wp ||
        !payload.inverter_power_kw)) ||
    (product.includes("ME") && !payload.storage_capacity_kwh) ||
    (financing !== "gotowka" && !payload.credit_amount)
  )
    return NextResponse.json(
      { error: "Uzupełnij wymagane moce, ilości oraz kwoty." },
      { status: 400 },
    );
  const insertResult = await supabaseAdmin
    .from("contracts")
    .insert(payload)
    .select()
    .single();
  let contract = insertResult.data as ContractRow | null;
  let error = insertResult.error;
  if (error?.message?.includes("contracts")) {
    contract = {
      ...payload,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      installation_at: null,
      tasks: CONTRACT_TASKS.map(([task_key]) => ({
        id: crypto.randomUUID(),
        contract_id: "",
        task_key,
        completed: false,
        completed_at: null,
        completed_by: null,
        updated_at: new Date().toISOString(),
      })),
    };
    contract.tasks = contract.tasks?.map((task) => ({
      ...task,
      contract_id: contract!.id,
    }));
    const fallback = await supabaseAdmin
      .from("lead_history")
      .insert({
        lead_id: leadId,
        user_id: profile.id,
        action_type: "contract_record",
        description: `Zapisano umowę ${payload.contract_number}.`,
        new_value: contract,
      });
    error = fallback.error;
  } else if (!error) {
    await supabaseAdmin
      .from("contract_tasks")
      .insert(
        CONTRACT_TASKS.map(([task_key]) => ({
          contract_id: contract!.id,
          task_key,
        })),
      );
  }
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contract }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  const { profile, supabaseAdmin } = auth;
  const body = (await request.json()) as Record<string, unknown>;
  const id = text(body, "id");
  const dbResult = await supabaseAdmin
    .from("contracts")
    .select(
      "*,creator:profiles!contracts_created_by_fkey(manager_id),tasks:contract_tasks(*)",
    )
    .eq("id", id)
    .eq("crm_environment", profile.crm_environment)
    .single();
  let contract = dbResult.data as ContractRow | null;
  let fallbackMode = Boolean(dbResult.error?.message?.includes("contracts"));
  if (!contract) {
    const historyContracts = await fallbackContracts(
      supabaseAdmin,
      profile.crm_environment,
    );
    contract = historyContracts.find((item) => item.id === id) || null;
    fallbackMode = Boolean(contract);
  }
  if (!contract)
    return NextResponse.json(
      { error: "Nie znaleziono umowy." },
      { status: 404 },
    );
  const canManageContract =
    ["owner", "admin"].includes(profile.role) ||
    (profile.role === "menadzer" &&
      (contract.created_by === profile.id ||
        contract.creator?.manager_id === profile.id));
  const isSalespersonContract =
    profile.role === "handlowiec" && contract.created_by === profile.id;
  if (!canManageContract && !isSalespersonContract)
    return NextResponse.json(
      { error: "Nie masz dostępu do edycji tej umowy." },
      { status: 403 },
    );
  const submissionStatus = submissionStatusOf(contract);
  const pendingUpdates: Record<string, unknown> = {};
  if (profile.role === "menadzer" && submissionStatus === "draft")
    return NextResponse.json(
      { error: "Menadżer nie ma dostępu do wersji roboczych umów zespołu." },
      { status: 403 },
    );
  if (text(body, "action") === "submit") {
    if (submissionStatus === "submitted")
      return GET(
        new Request(`${new URL(request.url).origin}/api/contracts?id=${id}`, {
          headers: request.headers,
        }),
      );
    if (profile.role === "menadzer")
      return NextResponse.json(
        { error: "Wersję roboczą wysyła jej autor albo administrator." },
        { status: 403 },
      );
    if (fallbackMode)
      return NextResponse.json(
        {
          error:
            "Uruchom migrację 18_contract_drafts_and_submission.sql przed wysłaniem umowy.",
        },
        { status: 409 },
      );
    const { error: submitError } = await supabaseAdmin.rpc("submit_contract", {
      p_contract_id: id,
      p_actor_id: profile.id,
    });
    if (submitError)
      return NextResponse.json({ error: submitError.message }, { status: 400 });
    return GET(
      new Request(`${new URL(request.url).origin}/api/contracts?id=${id}`, {
        headers: request.headers,
      }),
    );
  }
  if (text(body, "process_status")) {
    if (submissionStatus === "draft")
      return NextResponse.json(
        { error: "Najpierw wyślij kompletną umowę do weryfikacji." },
        { status: 409 },
      );
    const nextStatus = text(body, "process_status") as ContractStatus;
    if (!["owner", "admin", "menadzer"].includes(profile.role))
      return NextResponse.json(
        { error: "Brak uprawnień do zmiany procesu." },
        { status: 403 },
      );
    if (
      ![...ACTIVE_CONTRACT_STATUSES, "settled", "resigned", "paused"].includes(
        nextStatus,
      )
    )
      return NextResponse.json(
        { error: "Niepoprawny etap procesu." },
        { status: 400 },
      );
    if (nextStatus === "resigned" && !text(body, "note"))
      return NextResponse.json(
        { error: "Rezygnacja wymaga notatki." },
        { status: 400 },
      );
    contract.process_status = nextStatus;
    contract.is_process_visible = ACTIVE_CONTRACT_STATUSES.includes(nextStatus);
    contract.process_note = text(body, "note") || null;
    Object.assign(pendingUpdates, {
      process_status: contract.process_status,
      is_process_visible: contract.is_process_visible,
      process_note: contract.process_note,
    });
    if (nextStatus === "resigned") {
      contract.resignation_note = text(body, "note");
      contract.resigned_at = new Date().toISOString();
      Object.assign(pendingUpdates, {
        resignation_note: contract.resignation_note,
        resigned_at: contract.resigned_at,
      });
    }
  }
  if (text(body, "management_note")) {
    if (profile.role === "handlowiec")
      return NextResponse.json(
        {
          error: "Notatki są dostępne wyłącznie dla kierownictwa i realizacji.",
        },
        { status: 403 },
      );
    contract.management_notes = [
      ...(contract.management_notes || []),
      {
        id: crypto.randomUUID(),
        author: profile.full_name,
        content: text(body, "management_note"),
        created_at: new Date().toISOString(),
      },
    ];
    pendingUpdates.management_notes = contract.management_notes;
  }
  if (text(body, "task_key")) {
    if (!["owner", "admin"].includes(profile.role))
      return NextResponse.json(
        { error: "Zadaniami realizacji zarządza administrator." },
        { status: 403 },
      );
    const taskKey = text(body, "task_key");
    if (!CONTRACT_TASKS.some(([key]) => key === taskKey))
      return NextResponse.json(
        { error: "Niepoprawne zadanie." },
        { status: 400 },
      );
    const completed = bool(body, "completed");
    if (fallbackMode)
      contract.tasks = (contract.tasks || []).map(
        (task: Record<string, unknown>) =>
          task.task_key === taskKey
            ? {
                ...task,
                completed,
                completed_at: completed ? new Date().toISOString() : null,
                completed_by: completed ? profile.id : null,
                updated_at: new Date().toISOString(),
              }
            : task,
      );
    else {
      await supabaseAdmin
        .from("contract_tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? profile.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_id", id)
        .eq("task_key", taskKey);
      await supabaseAdmin
        .from("contract_task_history")
        .insert({
          contract_id: id,
          task_key: taskKey,
          completed,
          changed_by: profile.id,
        });
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "installation_at")) {
    if (!canManageContract)
      return NextResponse.json(
        { error: "Termin montażu zmienia przełożony lub administrator." },
        { status: 403 },
      );
    const installationAt = text(body, "installation_at") || null;
    if (fallbackMode) {
      contract.installation_at = installationAt;
      contract.updated_at = new Date().toISOString();
    } else
      await supabaseAdmin
        .from("contracts")
        .update({
          installation_at: installationAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    if (installationAt)
      await supabaseAdmin
        .from("calendar_events")
        .upsert({
          id,
          title: `Montaż — ${contract.customer_name}`,
          description: `Umowa ${contract.contract_number}`,
          starts_at: installationAt,
          owner_id: profile.id,
          owner_role: profile.role,
          visibility: "internal",
          created_by: profile.id,
          crm_environment: profile.crm_environment,
        });
  }
  if (body.contract_data && typeof body.contract_data === "object") {
    if (isSalespersonContract && submissionStatus !== "draft")
      return NextResponse.json(
        {
          error:
            "Po wysłaniu umowy handlowiec nie może już zmieniać jej danych.",
        },
        { status: 409 },
      );
    const source = body.contract_data as Record<string, unknown>;
    const editable = [
      "contract_number",
      "signed_at",
      "customer_name",
      "phone",
      "email",
      "postal_code",
      "city",
      "street",
      "house_number",
      "financing",
      "credit_amount",
      "product_type",
      "pv_power_kwp",
      "storage_capacity_kwh",
      "panel_power_wp",
      "panels_count",
      "has_inverter",
      "inverter_power_kw",
      "mounting_locations",
      "multiple_mounting_locations",
      "gross_amount",
      "backup_power",
      "optimizer_count",
      "surge_protection",
      "grounding",
      "additional_notes",
    ];
    const next = Object.fromEntries(
      editable
        .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
        .map((key) => [key, source[key]]),
    );
    if (fallbackMode) {
      Object.assign(contract, next);
      contract.updated_at = new Date().toISOString();
    } else {
      const { error } = await supabaseAdmin
        .from("contracts")
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  if (!fallbackMode && Object.keys(pendingUpdates).length) {
    const { error } = await supabaseAdmin
      .from("contracts")
      .update({ ...pendingUpdates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await supabaseAdmin
    .from("lead_history")
    .insert({
      lead_id: contract.lead_id,
      user_id: profile.id,
      action_type: "contract_record",
      description: `Zaktualizowano umowę ${contract.contract_number}.`,
      new_value: contract,
    });
  return GET(
    new Request(`${new URL(request.url).origin}/api/contracts?id=${id}`, {
      headers: request.headers,
    }),
  );
}

import { createClient } from "@supabase/supabase-js";

type AnyRecord = Record<string, unknown>;
type QueryResult = { data: unknown; error: null | { message: string } };
type Filter = {
  type: "eq" | "neq" | "in" | "is" | "not" | "gte" | "lte" | "lt" | "ilike" | "or";
  column?: string;
  value?: unknown;
  values?: unknown[];
};
type LocalProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  manager_id: string | null;
  business_phone: string | null;
  can_view_lead_pool: boolean;
  crm_environment: "production";
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const localCrmMode = process.env.NEXT_PUBLIC_LOCAL_CRM_MODE !== "false";
const adminPasswordHash =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256 ||
  "7cf96e8817c8d0790943c395d7e7231ef9b91d263315edc687427389b2e16611";

function isRealSupabaseUrl(value?: string) {
  return Boolean(
    value &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value) &&
      !value.includes("example") &&
      !value.includes("twoj-projekt")
  );
}

function isRealSupabaseKey(value?: string) {
  return Boolean(value && value !== "example-anon-key" && value !== "..." && value.length > 20);
}

const hasRealSupabase = !localCrmMode && isRealSupabaseUrl(supabaseUrl) && isRealSupabaseKey(supabaseAnonKey);

export const isLocalCrmFallback = localCrmMode || !hasRealSupabase;
export const isSupabaseConfigured = hasRealSupabase || isLocalCrmFallback;

const localProfiles: LocalProfile[] = [
  {
    id: "kacper-admin",
    email: "kacper.bernecki@gmail.com",
    full_name: "Kacper Bernecki",
    role: "admin",
    manager_id: null,
    business_phone: null,
    can_view_lead_pool: false,
    crm_environment: "production",
    created_at: "2026-06-05T10:00:00.000Z"
  },
  {
    id: "sales-manager",
    email: "manager@b-crm.local",
    full_name: "Manager sprzedazy",
    role: "kierownik",
    manager_id: "kacper-admin",
    business_phone: null,
    can_view_lead_pool: false,
    crm_environment: "production",
    created_at: "2026-06-05T10:10:00.000Z"
  },
  {
    id: "sales-rep",
    email: "handlowiec@b-crm.local",
    full_name: "Handlowiec",
    role: "handlowiec",
    manager_id: "sales-manager",
    business_phone: null,
    can_view_lead_pool: true,
    crm_environment: "production",
    created_at: "2026-06-05T10:20:00.000Z"
  }
];

const now = Date.now();
const localLeads = [
  lead("lead-001", "Jan Kowalski", "+48 600 700 800", "20-001", "Lublin, ul. Energetyczna 12", "Umowa", "sales-rep", "formularz", "BCRM/06/2026/001", -8, -2),
  lead("lead-002", "Marta Wisniewska", "+48 501 220 330", "21-500", "Rokitno 18", "Spotkanie", "sales-rep", "polecenie", null, -5, -1),
  lead("lead-003", "GreenPack Sp. z o.o.", "+48 512 300 110", "23-400", "Bilgoraj, ul. Przemyslowa 5", "Call back", "sales-rep", "B2B", null, -3, -0.5),
  lead("lead-004", "Auto-Komfort", "+48 535 118 445", "08-500", "Ryki, ul. Serwisowa 14", "Przypisany", "sales-rep", "B2B", null, -2, -1),
  lead("lead-005", "Justyna Sikora", "+48 537 908 222", "21-070", "Cycow, ul. Szkolna 2", "Nowy", null, "formularz", null, -1, -1),
  lead("lead-006", "Piotr Markowski", "+48 543 776 221", "24-220", "Niedrzwica Duza, ul. Lipowa 4", "Do weryfikacji", "sales-rep", "wlasne", null, -6, -3)
];

function lead(
  id: string,
  full_name: string,
  phone: string,
  postal_code: string,
  address: string,
  status: string,
  assigned_to: string | null,
  source: string,
  contract_number: string | null,
  createdDaysAgo: number,
  updatedHoursAgo: number
) {
  const updatedAt = new Date(now + updatedHoursAgo * 60 * 60 * 1000).toISOString();
  return {
    id,
    full_name,
    phone,
    email: null,
    phone_key: phone.replace(/\D/g, ""),
    email_key: null,
    postal_code,
    address,
    voivodeship: "lubelskie",
    county: "lubelski",
    status,
    assigned_to,
    source,
    resignation_reason: null,
    callback_at: status === "Call back" ? new Date(now + 3 * 60 * 60 * 1000).toISOString() : null,
    meeting_at: status === "Spotkanie" ? new Date(now + 27 * 60 * 60 * 1000).toISOString() : null,
    meeting_address: status === "Spotkanie" ? address : null,
    meeting_note: status === "Spotkanie" ? "Notatka ze spotkania." : null,
    contract_number,
    crm_environment: "production",
    created_at: new Date(now + createdDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: updatedAt,
    last_opened_at: updatedAt
  };
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function profileToSession(profile: LocalProfile) {
  return {
    access_token: `local-token-${profile.id}`,
    refresh_token: "local-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: profile.id,
      email: profile.email,
      app_metadata: { role: profile.role, crm_environment: "production" },
      user_metadata: { full_name: profile.full_name, role: profile.role, crm_environment: "production" }
    }
  };
}

function readLocalSession() {
  const raw = getStorage()?.getItem("bcrm-production-session");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: string };
    const profile = localProfiles.find((item) => item.email === parsed.email);
    return profile ? profileToSession(profile) : null;
  } catch {
    return null;
  }
}

function writeLocalSession(email: string) {
  getStorage()?.setItem("bcrm-production-session", JSON.stringify({ email }));
}

function clearLocalSession() {
  getStorage()?.removeItem("bcrm-production-session");
}

async function sha256(value: string) {
  if (!globalThis.crypto?.subtle) return "";
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function withRelations(row: AnyRecord) {
  if (!row || !("assigned_to" in row)) return row;
  return {
    ...row,
    assigned_profile: localProfiles.find((profile) => profile.id === row.assigned_to) || null
  };
}

function tableRows(table: string) {
  if (table === "profiles") return localProfiles.map((item) => ({ ...item }));
  if (table === "leads") return localLeads.map((item) => withRelations({ ...item }));
  if (table === "lead_history") return [];
  if (table === "lead_activities") return [];
  if (table === "lead_files") return [];
  if (table === "lead_reminders") return [];
  if (table === "calendar_events") return [];
  if (table === "daily_reports") return [];
  return [];
}

function compareValues(left: unknown, right: unknown) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

class LocalQuery {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private singleRow = false;
  private mutation: { type: "update" | "insert" | "upsert" | "delete"; payload?: unknown } | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }

  update(payload: AnyRecord) {
    this.mutation = { type: "update", payload };
    return this;
  }

  insert(payload: AnyRecord | AnyRecord[]) {
    this.mutation = { type: "insert", payload };
    return this;
  }

  upsert(payload: AnyRecord | AnyRecord[]) {
    this.mutation = { type: "upsert", payload };
    return this;
  }

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ type: "is", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ type: "not", column, value: operator === "is" ? value : undefined });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  or(value: string) {
    this.filters.push({ type: "or", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.maxRows = value;
    return this;
  }

  range(from: number, to: number) {
    this.maxRows = Math.max(to - from + 1, 0);
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  maybeSingle() {
    this.singleRow = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    if (this.mutation?.type === "insert" || this.mutation?.type === "upsert") {
      const payload = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload];
      const rows = payload.map((item) => ({ id: item.id || `local-${Date.now()}`, ...item }));
      return { data: this.singleRow ? rows[0] : rows, error: null };
    }

    let rows = tableRows(this.table).filter((row) => this.matches(row));

    if (this.mutation?.type === "update") {
      rows = rows.map((row) => ({ ...row, ...(this.mutation?.payload as AnyRecord) }));
    }

    if (this.mutation?.type === "delete") {
      rows = [];
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows.sort((a, b) => (ascending ? 1 : -1) * compareValues(a[column], b[column]));
    }

    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);

    return { data: this.singleRow ? rows[0] || null : rows, error: null };
  }

  private matches(row: AnyRecord) {
    return this.filters.every((filter) => {
      const value = filter.column ? row[filter.column] : undefined;
      if (filter.type === "eq") return value === filter.value;
      if (filter.type === "neq") return value !== filter.value;
      if (filter.type === "in") return filter.values?.includes(value);
      if (filter.type === "is") return value === filter.value;
      if (filter.type === "not") return value !== filter.value;
      if (filter.type === "gte") return String(value ?? "") >= String(filter.value ?? "");
      if (filter.type === "lte") return String(value ?? "") <= String(filter.value ?? "");
      if (filter.type === "lt") return String(value ?? "") < String(filter.value ?? "");
      if (filter.type === "ilike") {
        const pattern = String(filter.value ?? "").replaceAll("%", "").toLowerCase();
        return String(value ?? "").toLowerCase().includes(pattern);
      }
      if (filter.type === "or") return this.matchesOr(row, String(filter.value || ""));
      return true;
    });
  }

  private matchesOr(row: AnyRecord, expression: string) {
    if (expression.includes("assigned_to.is.null") && row.assigned_to === null) return true;
    const assignedMatch = expression.match(/assigned_to\.in\.\(([^)]+)\)/);
    if (assignedMatch && assignedMatch[1].split(",").includes(String(row.assigned_to))) return true;
    if (expression.includes("status.eq.Umowa") && row.status === "Umowa") return true;
    if (expression.includes("contract_number.not.is.null") && row.contract_number !== null) return true;
    return false;
  }
}

function createLocalCrmClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: readLocalSession() }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const normalizedEmail = email.trim().toLowerCase();
        const profile = localProfiles.find((item) => item.email === normalizedEmail);
        const passwordMatches = (await sha256(password)) === adminPasswordHash;

        if (!profile || profile.id !== "kacper-admin" || !passwordMatches) {
          return { data: { user: null, session: null }, error: { message: "Invalid credentials" } };
        }

        writeLocalSession(normalizedEmail);
        const session = profileToSession(profile);
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() {
        clearLocalSession();
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table: string) {
      return new LocalQuery(table);
    }
  };
}

export const supabase = hasRealSupabase
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (createLocalCrmClient() as unknown as ReturnType<typeof createClient>);

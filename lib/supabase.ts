import { createClient } from "@supabase/supabase-js";
import { demoModeEnabled } from "@/lib/demo-mode";

type AnyRecord = Record<string, unknown>;
type QueryResult = { data: unknown; error: null | { message: string } };
type Filter = { type: "eq" | "neq" | "in" | "is" | "not" | "gte" | "lte" | "lt" | "or"; column?: string; value?: unknown; values?: unknown[] };
type DemoProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  manager_id: string | null;
  business_phone: string | null;
  crm_environment: "demo";
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isRealSupabaseUrl(value?: string) {
  return Boolean(
    value &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value) &&
      !value.includes("example") &&
      !value.includes("twoj-projekt")
  );
}

function isRealSupabaseKey(value?: string) {
  return Boolean(
    value &&
      value !== "example-anon-key" &&
      value !== "..." &&
      value.length > 20
  );
}

const hasRealSupabase = isRealSupabaseUrl(supabaseUrl) && isRealSupabaseKey(supabaseAnonKey);

export const isDemoSupabaseFallback = demoModeEnabled && !hasRealSupabase;
export const isSupabaseConfigured = hasRealSupabase || isDemoSupabaseFallback;

const demoProfiles: DemoProfile[] = [
  { id: "demo-admin", email: "demo@example.com", full_name: "Demo Admin", role: "admin", manager_id: null, business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:00:00.000Z" },
  { id: "demo-manager", email: "demo-menadzer@example.com", full_name: "Magdalena Wojcik", role: "menadzer", manager_id: "demo-admin", business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:05:00.000Z" },
  { id: "demo-sales", email: "demo-handlowiec@example.com", full_name: "Piotr Zielinski", role: "handlowiec", manager_id: "demo-manager", business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:10:00.000Z" },
  { id: "demo-accounting", email: "demo-ksiegowy@example.com", full_name: "Ewa Mazur", role: "ksiegowosc", manager_id: "demo-admin", business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:15:00.000Z" },
  { id: "demo-logistics", email: "demo-logistyk@example.com", full_name: "Tomasz Krawczyk", role: "logistyk", manager_id: "demo-admin", business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:20:00.000Z" },
  { id: "demo-installer", email: "demo-monter@example.com", full_name: "Marek Lewandowski", role: "monter", manager_id: "demo-logistics", business_phone: null, crm_environment: "demo", created_at: "2026-05-01T08:25:00.000Z" }
];

const demoPasswords: Record<string, string> = {
  "demo@example.com": "demo-admin",
  "demo-menadzer@example.com": "demo-menadzer",
  "demo-handlowiec@example.com": "demo-handlowiec",
  "demo-ksiegowy@example.com": "demo-ksiegowy",
  "demo-logistyk@example.com": "demo-logistyk",
  "demo-monter@example.com": "demo-monter"
};

const now = Date.now();
const demoLeads = [
  lead("demo-lead-001", "Jan Kowalski", "+48 600 700 800", "20-001", "Lublin, ul. Energetyczna 12", "Umowa", "demo-sales", "B2C", "BCRM/05/2026/017", -8, -2),
  lead("demo-lead-002", "Marta Wisniewska", "+48 501 220 330", "21-500", "Rokitno 18", "Spotkanie", "demo-sales", "polecenie", null, -5, -1),
  lead("demo-lead-003", "GreenPack Sp. z o.o.", "+48 512 300 110", "23-400", "Bilgoraj, ul. Przemyslowa 5", "Call back", "demo-sales", "B2B", null, -3, -0.5),
  lead("demo-lead-004", "Auto-Komfort", "+48 535 118 445", "08-500", "Ryki, ul. Serwisowa 14", "Przypisany", "demo-sales", "B2B", null, -2, -1),
  lead("demo-lead-005", "Justyna Sikora", "+48 537 908 222", "21-070", "Cycow, ul. Szkolna 2", "Nowy", null, "B2C", null, -1, -1),
  lead("demo-lead-006", "Piotr Markowski", "+48 543 776 221", "24-220", "Niedrzwica Duza, ul. Lipowa 4", "Do weryfikacji", "demo-sales", "wlasne", null, -6, -3)
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
    meeting_note: status === "Spotkanie" ? "Demo meeting note." : null,
    contract_number,
    crm_environment: "demo",
    created_at: new Date(now + createdDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: updatedAt,
    last_opened_at: updatedAt
  };
}

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function profileToSession(profile: DemoProfile) {
  return {
    access_token: `demo-token-${profile.id}`,
    refresh_token: "demo-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: profile.id,
      email: profile.email,
      app_metadata: { role: profile.role, crm_environment: "demo" },
      user_metadata: { full_name: profile.full_name, role: profile.role, crm_environment: "demo" }
    }
  };
}

function readDemoSession() {
  if (!isDemoSupabaseFallback) return null;

  const storage = getSessionStorage();
  const raw = storage?.getItem("bcrm-demo-session");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: string };
    const profile = demoProfiles.find((item) => item.email === parsed.email);
    return profile ? profileToSession(profile) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(email: string) {
  getSessionStorage()?.setItem("bcrm-demo-session", JSON.stringify({ email }));
}

function clearDemoSession() {
  getSessionStorage()?.removeItem("bcrm-demo-session");
}

function withRelations(row: AnyRecord) {
  if (!row || !("assigned_to" in row)) return row;
  return {
    ...row,
    assigned_profile: demoProfiles.find((profile) => profile.id === row.assigned_to) || null
  };
}

function tableRows(table: string) {
  if (table === "profiles") return demoProfiles.map((item) => ({ ...item }));
  if (table === "leads") return demoLeads.map((item) => withRelations({ ...item }));
  return [];
}

function compareValues(left: unknown, right: unknown) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

class DemoQuery {
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

  single() {
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
      const rows = payload.map((item) => ({ id: item.id || `demo-${Date.now()}`, ...item }));
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

function createDemoSupabaseClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: readDemoSession() }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        if (!isDemoSupabaseFallback) {
          return { data: { user: null, session: null }, error: { message: "Supabase is not configured" } };
        }

        const normalizedEmail = email.trim().toLowerCase();
        const profile = demoProfiles.find((item) => item.email === normalizedEmail);
        if (!profile || demoPasswords[normalizedEmail] !== password) {
          return { data: { user: null, session: null }, error: { message: "Invalid demo credentials" } };
        }
        writeDemoSession(normalizedEmail);
        const session = profileToSession(profile);
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() {
        clearDemoSession();
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table: string) {
      return new DemoQuery(table);
    }
  };
}

export const supabase = hasRealSupabase
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (createDemoSupabaseClient() as unknown as ReturnType<typeof createClient>);

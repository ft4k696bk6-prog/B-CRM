import { createClient } from "@supabase/supabase-js";
import { importedLeadHistorySeedRows, importedLeadSeedMeta, importedLeadSeedRows } from "@/lib/imported-leads";

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
type LocalTableName =
  | "leads"
  | "lead_history"
  | "lead_activities"
  | "lead_files"
  | "lead_reminders"
  | "calendar_events"
  | "daily_reports";
type LocalDataStore = Partial<Record<LocalTableName, AnyRecord[]>>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const localCrmMode = process.env.NEXT_PUBLIC_LOCAL_CRM_MODE !== "false";
const localDataStorageKey = "bcrm-production-local-data-v2";
const localSeedStorageKey = "bcrm-production-import-seed-version";
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

function readLocalDataStore(): LocalDataStore {
  const raw = getStorage()?.getItem(localDataStorageKey);
  if (!raw) return withImportedLeadSeed({});
  try {
    return withImportedLeadSeed(JSON.parse(raw) as LocalDataStore);
  } catch {
    return withImportedLeadSeed({});
  }
}

function mergeSeedRows(existingRows: AnyRecord[] | undefined, seedRows: AnyRecord[], keys: string[]) {
  const rows = [...(existingRows || [])];

  seedRows.forEach((seed) => {
    const index = rows.findIndex((row) =>
      keys.some((key) => {
        const left = row[key];
        const right = seed[key];
        return Boolean(left && right && left === right);
      })
    );

    if (index >= 0) {
      rows[index] = { ...seed, ...rows[index] };
    } else {
      rows.push({ ...seed });
    }
  });

  return rows;
}

function withImportedLeadSeed(store: LocalDataStore): LocalDataStore {
  if (importedLeadSeedRows.length === 0 && importedLeadHistorySeedRows.length === 0) return store;

  const storage = getStorage();
  const currentVersion = storage?.getItem(localSeedStorageKey);
  if (currentVersion === importedLeadSeedMeta.version) return store;

  const nextStore: LocalDataStore = {
    ...store,
    leads: mergeSeedRows(store.leads, importedLeadSeedRows, ["id", "phone_key", "email_key"]),
    lead_history: mergeSeedRows(store.lead_history, importedLeadHistorySeedRows, ["id"])
  };

  storage?.setItem(localDataStorageKey, JSON.stringify(nextStore));
  storage?.setItem(localSeedStorageKey, importedLeadSeedMeta.version);

  return nextStore;
}

function writeLocalDataStore(store: LocalDataStore) {
  getStorage()?.setItem(localDataStorageKey, JSON.stringify(store));
}

function isLocalTableName(table: string): table is LocalTableName {
  return [
    "leads",
    "lead_history",
    "lead_activities",
    "lead_files",
    "lead_reminders",
    "calendar_events",
    "daily_reports"
  ].includes(table);
}

function readStoredRows(table: string): AnyRecord[] {
  if (table === "profiles") return localProfiles.map((item) => ({ ...item }));
  if (!isLocalTableName(table)) return [];
  const store = readLocalDataStore();
  return (store[table] || []).map((item) => ({ ...item }));
}

function writeStoredRows(table: string, rows: AnyRecord[]) {
  if (!isLocalTableName(table)) return;
  const store = readLocalDataStore();
  store[table] = rows.map((item) => ({ ...item }));
  writeLocalDataStore(store);
}

function localId(table: string) {
  return `${table}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLocalInsert(table: string, item: unknown) {
  const row = { ...((item || {}) as AnyRecord) };
  const timestamp = new Date().toISOString();

  row.id = row.id || localId(table);

  if (table === "leads") {
    const phone = String(row.phone || "");
    row.email = row.email || null;
    row.phone_key = row.phone_key || phone.replace(/\D/g, "");
    row.email_key = row.email_key || null;
    row.postal_code = row.postal_code || null;
    row.address = row.address || null;
    row.voivodeship = row.voivodeship || null;
    row.county = row.county || null;
    row.status = row.status || "Nowy";
    row.assigned_to = row.assigned_to || null;
    row.source = row.source || "wlasne";
    row.resignation_reason = row.resignation_reason || null;
    row.callback_at = row.callback_at || null;
    row.meeting_at = row.meeting_at || null;
    row.meeting_address = row.meeting_address || null;
    row.meeting_note = row.meeting_note || null;
    row.contract_number = row.contract_number || null;
    row.crm_environment = row.crm_environment || "production";
    row.created_at = row.created_at || timestamp;
    row.updated_at = row.updated_at || timestamp;
    row.last_opened_at = row.last_opened_at || null;
  }

  if (table === "lead_history" || table === "lead_activities") {
    row.created_at = row.created_at || timestamp;
    row.user_id = row.user_id || "kacper-admin";
    row.old_value = row.old_value || null;
    row.new_value = row.new_value || null;
    row.metadata = row.metadata || null;
  }

  return row;
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
  const rows = readStoredRows(table);
  if (table === "leads") return rows.map((item) => withRelations(item));
  if (table === "lead_history" || table === "lead_activities") {
    return rows.map((item) => ({
      ...item,
      user_profile: localProfiles.find((profile) => profile.id === item.user_id) || null
    }));
  }
  return rows;
}

function compareValues(left: unknown, right: unknown) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

class LocalQuery {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rowOffset = 0;
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
    this.rowOffset = 0;
    this.maxRows = value;
    return this;
  }

  range(from: number, to: number) {
    this.rowOffset = Math.max(from, 0);
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
      const currentRows = readStoredRows(this.table);
      const payload = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload];
      const rows = payload.map((item) => normalizeLocalInsert(this.table, item));

      if (isLocalTableName(this.table)) {
        if (this.mutation.type === "upsert") {
          const nextRows = [...currentRows];
          rows.forEach((row) => {
            const index = nextRows.findIndex((item) => item.id === row.id);
            if (index >= 0) {
              nextRows[index] = { ...nextRows[index], ...row };
            } else {
              nextRows.push(row);
            }
          });
          writeStoredRows(this.table, nextRows);
        } else {
          writeStoredRows(this.table, [...currentRows, ...rows]);
        }
      }

      return { data: this.singleRow ? rows[0] : rows, error: null };
    }

    if (this.mutation?.type === "update") {
      const currentRows = readStoredRows(this.table);
      const updatedRows = currentRows.map((row) =>
        this.matches(row)
          ? {
              ...row,
              ...(this.mutation?.payload as AnyRecord),
              ...(this.table === "leads" ? { updated_at: new Date().toISOString() } : {})
            }
          : row
      );
      writeStoredRows(this.table, updatedRows);
    }

    if (this.mutation?.type === "delete") {
      const currentRows = readStoredRows(this.table);
      writeStoredRows(
        this.table,
        currentRows.filter((row) => !this.matches(row))
      );
    }

    let rows = tableRows(this.table).filter((row) => this.matches(row));

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows.sort((a, b) => (ascending ? 1 : -1) * compareValues(a[column], b[column]));
    }

    if (this.maxRows !== null) rows = rows.slice(this.rowOffset, this.rowOffset + this.maxRows);

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
    const assignedEqMatch = expression.match(/assigned_to\.eq\.([^,]+)/);
    if (assignedEqMatch && String(row.assigned_to) === assignedEqMatch[1]) return true;
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

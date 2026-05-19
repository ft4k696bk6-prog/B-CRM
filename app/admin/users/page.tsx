"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ChevronDown,
  GitBranch,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  UserRoundPlus,
  type LucideIcon
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, ConfirmDialog, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { normalizeRole, ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type OrgMeta = {
  title: string;
  department: string;
};

type OrgNode = {
  profile: Profile;
  meta: OrgMeta;
  children: OrgNode[];
};

const roleToneClasses: Record<UserRole, string> = {
  owner: "border-ink/15 bg-ink text-white",
  admin: "border-sky/20 bg-sky/10 text-sky",
  menadzer: "border-leaf/20 bg-leaf/10 text-leaf",
  handlowiec: "border-solar/25 bg-solar/10 text-[#8a5a00]",
  finance: "border-sky/20 bg-sky/10 text-sky",
  viewer: "border-line bg-[#f8fafc] text-muted",
  ksiegowosc: "border-leaf/20 bg-leaf/10 text-leaf",
  logistyk: "border-warn/25 bg-warn/10 text-warn",
  monter: "border-danger/20 bg-danger/10 text-danger"
};

const demoOrgMetaByEmail: Record<string, OrgMeta> = {
  "demo@example.com": { title: "Administrator CRM", department: "Zarząd i administracja" },
  "demo-menadzer@example.com": { title: "Menadżer sprzedaży", department: "Sprzedaż" },
  "demo-handlowiec@example.com": { title: "Handlowiec B2C", department: "Sprzedaż" },
  "demo-ksiegowy@example.com": { title: "Specjalista ds. księgowości", department: "Księgowość" },
  "demo-logistyk@example.com": { title: "Koordynator logistyki", department: "Logistyka" },
  "demo-monter@example.com": { title: "Monter prowadzący", department: "Montaż" },
  "demo-owner@example.com": { title: "Właściciel / CEO", department: "Zarząd" },
  "demo-dyrektor-sprzedazy@example.com": { title: "Dyrektor sprzedaży", department: "Sprzedaż" },
  "demo-regionalny-wschod@example.com": { title: "Dyrektor regionalny - Wschód", department: "Sprzedaż" },
  "demo-kierownik-b2b@example.com": { title: "Kierownik B2B", department: "Sprzedaż B2B" },
  "demo-kierownik-b2c@example.com": { title: "Kierownik B2C", department: "Sprzedaż B2C" },
  "demo-handlowiec-b2b@example.com": { title: "Handlowiec B2B", department: "Sprzedaż B2B" },
  "demo-handlowiec-b2c@example.com": { title: "Handlowiec B2C", department: "Sprzedaż B2C" },
  "demo-handlowiec-field@example.com": { title: "Doradca terenowy", department: "Sprzedaż terenowa" },
  "demo-finanse@example.com": { title: "Analityk finansowania", department: "Finanse" },
  "demo-dyrektor-operacyjny@example.com": { title: "Dyrektor operacyjny", department: "Operacje" },
  "demo-magazyn@example.com": { title: "Specjalista magazynu", department: "Logistyka" },
  "demo-monter-2@example.com": { title: "Monter", department: "Montaż" },
  "demo-audyt@example.com": { title: "Podgląd zarządczy", department: "Audyt" }
};

const fallbackOrgMeta: Record<UserRole, OrgMeta> = {
  owner: { title: "Właściciel", department: "Zarząd" },
  admin: { title: "Administrator CRM", department: "Administracja" },
  menadzer: { title: "Menadżer zespołu", department: "Zarządzanie" },
  handlowiec: { title: "Handlowiec", department: "Sprzedaż" },
  finance: { title: "Finanse", department: "Finanse" },
  viewer: { title: "Dostęp tylko do odczytu", department: "Podgląd" },
  ksiegowosc: { title: "Księgowość", department: "Księgowość" },
  logistyk: { title: "Logistyka", department: "Logistyka" },
  monter: { title: "Montaż", department: "Montaż" }
};

function orgMetaFor(profile: Profile): OrgMeta {
  const email = profile.email?.toLowerCase();
  if (email && demoOrgMetaByEmail[email]) return demoOrgMetaByEmail[email];
  return fallbackOrgMeta[profile.role];
}

function buildOrgTree(users: Profile[]): OrgNode[] {
  const nodes = new Map<string, OrgNode>();

  users.forEach((user) => {
    nodes.set(user.id, {
      profile: user,
      meta: orgMetaFor(user),
      children: []
    });
  });

  const roots: OrgNode[] = [];

  users.forEach((user) => {
    const node = nodes.get(user.id);
    if (!node) return;

    if (user.manager_id && nodes.has(user.manager_id)) {
      nodes.get(user.manager_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: OrgNode[]) => {
    items.sort((left, right) => {
      const roleOrder = USER_ROLES.indexOf(left.profile.role) - USER_ROLES.indexOf(right.profile.role);
      return roleOrder || left.profile.full_name.localeCompare(right.profile.full_name, "pl");
    });
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

function CollapsibleSection({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = false
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group app-card" open={defaultOpen}>
      <summary className="-m-5 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-5 transition hover:bg-[#f8fafc] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start gap-3">
          <span className="app-icon bg-sky/10 text-sky">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-ink">{title}</span>
            {description ? <span className="mt-1 block text-sm leading-6 text-muted">{description}</span> : null}
          </span>
        </span>
        <ChevronDown className="h-5 w-5 flex-none text-muted transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-5 border-t border-line pt-5">{children}</div>
    </details>
  );
}

function OrgTree({ nodes }: { nodes: OrgNode[] }) {
  return (
    <div className="grid gap-3">
      {nodes.map((node) => (
        <OrgTreeNode key={node.profile.id} node={node} />
      ))}
    </div>
  );
}

function OrgTreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  return (
    <div className={depth > 0 ? "border-l border-line pl-4" : ""}>
      <div className="rounded-lg border border-line bg-[#f9fbfd] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-black text-ink">{node.profile.full_name}</div>
            <div className="mt-1 text-sm font-semibold text-muted">{node.meta.title}</div>
            <div className="mt-1 text-xs text-muted">{node.meta.department}</div>
          </div>
          <span className={`w-fit rounded-md border px-2 py-1 text-xs font-bold ${roleToneClasses[node.profile.role]}`}>
            {ROLE_LABELS[node.profile.role]}
          </span>
        </div>
      </div>
      {node.children.length > 0 ? (
        <div className="mt-3 grid gap-3">
          {node.children.map((child) => (
            <OrgTreeNode key={child.profile.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function UsersPage() {
  const { loading, profile, session } = useAuth(["owner", "admin"]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [newRole, setNewRole] = useState<UserRole>("handlowiec");
  const [newManagerId, setNewManagerId] = useState("");
  const [newBusinessPhone, setNewBusinessPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  async function loadUsers() {
    if (!session) return;

    const response = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać użytkowników.");
      return;
    }

    const nextUsers = ((body.users || []) as Profile[]).map((user) => ({
      ...user,
      business_phone: user.business_phone || null,
      role: normalizeRole(user.role, user.email)
    }));

    setUsers(nextUsers);
    setPhoneDrafts(
      Object.fromEntries(nextUsers.map((user) => [user.id, user.business_phone || ""]))
    );
  }

  useEffect(() => {
    loadUsers();
  }, [session?.access_token]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        fullName,
        email,
        password,
        role: newRole,
        managerId: newRole === "handlowiec" ? newManagerId || null : null,
        businessPhone: newBusinessPhone || null
      })
    });

    const body = await response.json();

    if (!response.ok) {
      setError(body.error || "Nie udało się utworzyć użytkownika.");
    } else {
      setSuccess("Utworzono konto użytkownika.");
      setFullName("");
      setEmail("");
      setPassword("");
      setNewBusinessPhone("");
      setNewRole("handlowiec");
      setNewManagerId("");
      await loadUsers();
    }

    setBusy(false);
  }

  async function updateUser(userId: string, role: UserRole, managerId?: string | null, businessPhone?: string) {
    if (!session) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        id: userId,
        role,
        managerId: role === "handlowiec" ? managerId || null : null,
        ...(businessPhone !== undefined ? { businessPhone } : {})
      })
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error || "Nie udało się zmienić roli.");
    } else {
      setSuccess("Zapisano użytkownika.");
      await loadUsers();
    }

    setBusy(false);
  }

  async function deleteUser() {
    if (!session || busy) return;
    if (!deleteTarget) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: deleteTarget.id })
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error || "Nie udało się usunąć użytkownika.");
    } else {
      setSuccess("Usunięto konto użytkownika.");
      setDeleteTarget(null);
      await loadUsers();
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  const visibleUsers = roleFilter ? users.filter((user) => user.role === roleFilter) : users;
  const managers = users.filter((user) => user.role === "menadzer");
  const salespeople = users.filter((user) => user.role === "handlowiec");
  const unassignedSalespeople = salespeople.filter((user) => !user.manager_id);
  const orgTree = buildOrgTree(users);
  const adminCount = users.filter((user) => user.role === "owner" || user.role === "admin").length;
  const operationsCount = users.filter((user) =>
    ["finance", "ksiegowosc", "logistyk", "monter"].includes(user.role)
  ).length;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Użytkownicy"
          description="Konta, role i przypisania w CRM."
          actions={
            <button type="button" onClick={loadUsers} className="btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Odśwież
            </button>
          }
        />


        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Wszyscy</div>
            <div className="mt-2 text-3xl font-black text-ink">{users.length}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Admin</div>
            <div className="mt-2 text-3xl font-black text-ink">{adminCount}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Menadżerowie</div>
            <div className="mt-2 text-3xl font-black text-ink">{managers.length}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Handlowcy</div>
            <div className="mt-2 text-3xl font-black text-ink">{salespeople.length}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Operacje</div>
            <div className="mt-2 text-3xl font-black text-ink">{operationsCount}</div>
          </div>
        </section>

        <section className="app-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-black text-ink">Lista użytkowników</h2>
              <p className="mt-1 text-sm text-muted">Najważniejszy widok do codziennego zarządzania dostępami.</p>
            </div>
            <label className="block w-full max-w-xs">
              <span className="label">Filtr roli</span>
              <select
                className="field"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | "")}
              >
                <option value="">Wszystkie role</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : null}

        {success ? (
          <Alert tone="success">{success}</Alert>
        ) : null}

        <CollapsibleSection
          icon={ShieldCheck}
          title="Role i uprawnienia"
          description="Szczegółowy opis ról jest schowany, bo nie jest potrzebny w codziennej pracy."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {USER_ROLES.map((role) => (
              <div key={role} className="rounded-lg border border-line bg-[#f9fbfd] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-ink">{ROLE_LABELS[role]}</div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-bold ${roleToneClasses[role]}`}>
                    {users.filter((user) => user.role === role).length}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          icon={UserRoundPlus}
          title="Nowy użytkownik"
          description="Dodawanie kont jest dostępne pod ręką, ale nie zajmuje miejsca na stałe."
        >
          <SectionHeader icon={UserRoundCog} title="Dane konta" tone="leaf" />

          <form onSubmit={createUser} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px_180px_220px_auto]">
            <label>
              <span className="label">Imię i nazwisko</span>
              <input
                className="field"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="label">E-mail</span>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="label">Hasło startowe</span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              <span className="label">Telefon CRM</span>
              <input
                className="field"
                value={newBusinessPhone}
                onChange={(event) => setNewBusinessPhone(event.target.value)}
                placeholder="+48 600 000 000"
              />
            </label>
            <label>
              <span className="label">Rola</span>
              <select
                className="field"
                value={newRole}
                onChange={(event) => {
                  const nextRole = event.target.value as UserRole;
                  setNewRole(nextRole);
                  if (nextRole !== "handlowiec") setNewManagerId("");
                }}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Menadżer</span>
              <select
                className="field"
                value={newManagerId}
                onChange={(event) => setNewManagerId(event.target.value)}
                disabled={newRole !== "handlowiec"}
              >
                <option value="">Bez menadżera</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={busy} className="btn-primary w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Dodaj
              </button>
            </div>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          icon={GitBranch}
          title="Struktura zespołu"
          description="Drzewko organizacyjne pokazuje przełożonych, działy i role bez zajmowania głównego HUD-u."
        >
          {orgTree.length > 0 ? (
            <OrgTree nodes={orgTree} />
          ) : (
            <EmptyState title="Brak struktury" description="Dodaj użytkowników albo odśwież listę." />
          )}
          {unassignedSalespeople.length > 0 ? (
            <Alert tone="warning" className="mt-4">
              {unassignedSalespeople.length} handlowców nie ma przypisanego menadżera.
            </Alert>
          ) : null}
        </CollapsibleSection>

        <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm md:max-h-[58vh] md:overflow-y-auto">
          <div className="hidden overflow-x-auto md:block">
          <table className="app-table min-w-[920px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Imię i nazwisko</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefon CRM</th>
                <th className="px-4 py-3">Rola</th>
                <th className="px-4 py-3">Menadżer</th>
                <th className="px-4 py-3">Utworzony</th>
                <th className="px-4 py-3">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleUsers.map((person) => (
                <tr key={person.id}>
                  <td className="px-4 py-3 font-semibold">{person.full_name}</td>
                  <td className="px-4 py-3 text-muted">{person.email}</td>
                  <td className="px-4 py-3 text-muted">
                    <input
                      className="field min-w-44"
                      value={phoneDrafts[person.id] ?? person.business_phone ?? ""}
                      onChange={(event) =>
                        setPhoneDrafts((current) => ({ ...current, [person.id]: event.target.value }))
                      }
                      onBlur={(event) => updateUser(person.id, person.role, person.manager_id, event.target.value)}
                      placeholder="+48 600 000 000"
                      disabled={busy}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <select
                      className="field min-w-40"
                      value={person.role}
                      onChange={(event) =>
                        updateUser(person.id, event.target.value as UserRole, person.manager_id)
                      }
                      disabled={busy}
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <select
                      className="field min-w-48"
                      value={person.manager_id || ""}
                      onChange={(event) => updateUser(person.id, person.role, event.target.value || null)}
                      disabled={busy || person.role !== "handlowiec"}
                    >
                      <option value="">Bez menadżera</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat("pl-PL", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(person.created_at))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-leaf">
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        Autozapis
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(person)}
                        disabled={busy}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-danger/20 bg-danger/5 px-3 text-xs font-semibold text-danger transition hover:border-danger/40 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="grid gap-3 p-3 md:hidden">
            {visibleUsers.map((person) => (
              <article key={person.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-ink">{person.full_name}</div>
                    <div className="mt-1 truncate text-xs font-semibold text-muted">{person.email}</div>
                  </div>
                  <span className="rounded-md border border-line bg-[#f8fafc] px-2 py-1 text-xs font-bold text-muted">
                    {ROLE_LABELS[person.role]}
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  <label>
                    <span className="label">Telefon CRM</span>
                    <input
                      className="field"
                      value={phoneDrafts[person.id] ?? person.business_phone ?? ""}
                      onChange={(event) =>
                        setPhoneDrafts((current) => ({ ...current, [person.id]: event.target.value }))
                      }
                      onBlur={(event) => updateUser(person.id, person.role, person.manager_id, event.target.value)}
                      placeholder="+48 600 000 000"
                      disabled={busy}
                    />
                  </label>
                  <label>
                    <span className="label">Rola</span>
                    <select
                      className="field"
                      value={person.role}
                      onChange={(event) => updateUser(person.id, event.target.value as UserRole, person.manager_id)}
                      disabled={busy}
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Menadżer</span>
                    <select
                      className="field"
                      value={person.manager_id || ""}
                      onChange={(event) => updateUser(person.id, person.role, event.target.value || null)}
                      disabled={busy || person.role !== "handlowiec"}
                    >
                      <option value="">Bez menadżera</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-leaf">
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Autozapis
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(person)}
                    disabled={busy}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-danger/20 bg-danger/5 px-3 text-xs font-bold text-danger transition hover:border-danger/40 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Usuń
                  </button>
                </div>
              </article>
            ))}
          </div>
          {visibleUsers.length === 0 ? (
            <EmptyState title="Brak użytkowników" description="Zmień filtr roli albo odśwież listę." className="m-3" />
          ) : null}
        </section>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Usunąć użytkownika?"
          description={`Konto ${deleteTarget?.full_name || ""} zostanie usunięte. Tej akcji nie można cofnąć.`}
          confirmLabel="Usuń"
          tone="danger"
          busy={busy}
          onConfirm={deleteUser}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    </AppShell>
  );
}

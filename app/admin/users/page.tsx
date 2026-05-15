"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, RefreshCw, Save, UserRoundPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { normalizeRole, ROLE_LABELS, USER_ROLES } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

export default function UsersPage() {
  const { loading, profile, session } = useAuth("admin");
  const [users, setUsers] = useState<Profile[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [newRole, setNewRole] = useState<UserRole>("handlowiec");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    setUsers(
      ((body.users || []) as Profile[]).map((user) => ({
        ...user,
        role: normalizeRole(user.role)
      }))
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
        role: newRole
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
      setNewRole("handlowiec");
      await loadUsers();
    }

    setBusy(false);
  }

  async function updateRole(userId: string, role: UserRole) {
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
      body: JSON.stringify({ id: userId, role })
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error || "Nie udało się zmienić roli.");
    } else {
      setSuccess("Zapisano rolę użytkownika.");
      await loadUsers();
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  const visibleUsers = roleFilter ? users.filter((user) => user.role === roleFilter) : users;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="section-title">Użytkownicy</h1>
            <p className="mt-1 text-sm text-muted">Konta i role dostępu w CRM.</p>
          </div>
          <button type="button" onClick={loadUsers} className="btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Odśwież
          </button>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
              <UserRoundPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-ink">Nowy użytkownik</h2>
          </div>

          {error ? (
            <div className="mb-4 flex gap-3 rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 flex gap-3 rounded-md border border-leaf/20 bg-leaf/10 p-3 text-sm text-leaf">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>{success}</span>
            </div>
          ) : null}

          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_180px_auto]">
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
              <span className="label">Rola</span>
              <select
                className="field"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as UserRole)}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
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
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <label className="block max-w-xs">
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
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-[#f9fbfd] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Imię i nazwisko</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Rola</th>
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
                    <select
                      className="field min-w-40"
                      value={person.role}
                      onChange={(event) => updateRole(person.id, event.target.value as UserRole)}
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
                    {new Intl.DateTimeFormat("pl-PL", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(person.created_at))}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-leaf">
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      Autozapis
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleUsers.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-muted">
              Brak użytkowników dla wybranego filtra.
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

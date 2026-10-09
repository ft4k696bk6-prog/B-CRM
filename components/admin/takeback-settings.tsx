"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, RefreshCw, X } from "lucide-react";
import { normalizeRole, ROLE_LABELS } from "@/lib/roles";
import { useAuth } from "@/lib/use-auth";

type TakebackUser = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  auto_takeback_enabled?: boolean | null;
};

export function TakebackSettings() {
  const { profile, session } = useAuth(["owner", "admin"]);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<TakebackUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.full_name.localeCompare(b.full_name, "pl")),
    [users]
  );

  async function loadUsers() {
    if (!session) return;

    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać ustawień użytkowników.");
    } else {
      setUsers((body.users || []) as TakebackUser[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (open && session) void loadUsers();
  }, [open, session?.access_token]);

  async function setTakeback(user: TakebackUser, enabled: boolean) {
    if (!session || savingId) return;

    setSavingId(user.id);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/users/takeback", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        id: user.id,
        autoTakebackEnabled: enabled
      })
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać ustawienia.");
    } else {
      setUsers((current) =>
        current.map((person) =>
          person.id === user.id
            ? { ...person, auto_takeback_enabled: body.auto_takeback_enabled }
            : person
        )
      );
      setSuccess(
        enabled
          ? `${user.full_name}: leady będą zabierane przez automat o 22:00.`
          : `${user.full_name}: automat o 22:00 nie będzie zabierał leadów.`
      );
    }

    setSavingId(null);
  }

  if (!profile || !session) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[80] inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-90"
      >
        <Clock3 className="h-4 w-4" aria-hidden="true" />
        Automat 22:00
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4">
          <section className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div>
                <div className="flex items-center gap-2 text-lg font-black text-ink">
                  <Clock3 className="h-5 w-5 text-sky" aria-hidden="true" />
                  Automat zabierania leadów o 22:00
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Wyłącz automat przy osobie, której leady mają zostać przypisane po 22:00. Ręczne przypisywanie leadów działa bez zmian.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-md border border-line text-muted transition hover:bg-[#f8fafc] hover:text-ink"
                aria-label="Zamknij ustawienia automatu 22:00"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex items-center justify-between gap-3 border-b border-line bg-[#f8fafc] px-5 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">
                Użytkownicy: {users.length}
              </div>
              <button
                type="button"
                onClick={() => void loadUsers()}
                disabled={loading || Boolean(savingId)}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                Odśwież
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {error ? (
                <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="mb-4 rounded-lg border border-leaf/20 bg-leaf/5 px-4 py-3 text-sm font-semibold text-leaf">
                  {success}
                </div>
              ) : null}

              {loading && users.length === 0 ? (
                <div className="py-10 text-center text-sm font-semibold text-muted">Pobieranie ustawień...</div>
              ) : (
                <div className="grid gap-3">
                  {sortedUsers.map((user) => {
                    const enabled = user.auto_takeback_enabled !== false;
                    const role = normalizeRole(user.role, user.email);
                    const isSaving = savingId === user.id;

                    return (
                      <article
                        key={user.id}
                        className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-black text-ink">{user.full_name}</div>
                          <div className="mt-1 text-xs text-muted">
                            {ROLE_LABELS[role]}{user.email ? ` · ${user.email}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-pressed={enabled}
                          disabled={Boolean(savingId)}
                          onClick={() => void setTakeback(user, !enabled)}
                          className={`inline-flex min-h-11 min-w-[210px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                            enabled
                              ? "border-danger/20 bg-danger/5 text-danger"
                              : "border-leaf/20 bg-leaf/5 text-leaf"
                          }`}
                        >
                          <span>
                            <span className="block text-xs font-black">
                              {isSaving
                                ? "Zapisywanie..."
                                : enabled
                                  ? "Zabieraj leady o 22:00"
                                  : "Nie zabieraj leadów o 22:00"}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold opacity-75">
                              {enabled ? "Automat włączony" : "Automat wyłączony"}
                            </span>
                          </span>
                          <span
                            className={`relative h-6 w-11 flex-none rounded-full transition ${
                              enabled ? "bg-danger/70" : "bg-leaf/70"
                            }`}
                            aria-hidden="true"
                          >
                            <span
                              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                enabled ? "left-6" : "left-1"
                              }`}
                            />
                          </span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-muted">
                Ustawienie dotyczy tylko nocnego zwrotu zwykłych, otwartych leadów. Callbacki i spotkania nadal są wyłączone z automatycznego zabierania zgodnie z obecną logiką CRM.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

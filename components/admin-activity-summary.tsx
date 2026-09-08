"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, MessageSquareText, RefreshCw, UsersRound } from "lucide-react";
import { Alert, EmptyState, SectionHeader } from "@/components/ui";
import { normalizeRole, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

type ActivitySummary = {
  userId: string;
  fullName: string;
  email: string | null;
  role: UserRole | "sales" | "manager" | string;
  openedLeads: number;
  statusChanges: number;
  comments: number;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function activityRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

export function AdminActivitySummary({ accessToken }: { accessToken: string }) {
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [from, setFrom] = useState(() => isoDate(new Date()));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(range?: { from: string; to: string }) {
    if (!accessToken) return;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      from: range?.from || from,
      to: range?.to || to
    });

    const response = await fetch(`/api/admin/activity-summary?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać aktywności.");
    } else {
      setSummaries((body.summaries || []) as ActivitySummary[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // Initial load is intentionally tied only to the authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function selectRange(days: number) {
    const range = activityRange(days);
    setFrom(range.from);
    setTo(range.to);
    void load(range);
  }

  const visibleSummaries = useMemo(
    () => selectedUserId ? summaries.filter((summary) => summary.userId === selectedUserId) : summaries,
    [selectedUserId, summaries]
  );

  return (
    <section className="app-card min-w-0">
      <SectionHeader
        icon={UsersRound}
        title="Podsumowanie aktywności handlowców i menadżerów"
        description="Kontrola pracy całego zespołu sprzedaży, w tym handlowców i menadżerów, dla wybranego dnia lub okresu."
        tone="sky"
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto] lg:items-end">
        <label>
          <span className="label">Użytkownik</span>
          <select className="field" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            <option value="">Wszyscy handlowcy i menadżerowie</option>
            {summaries.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.fullName} · {ROLE_LABELS[normalizeRole(person.role, person.email)]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Data od</span>
          <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span className="label">Data do</span>
          <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Pokaż aktywność
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => selectRange(1)}>Dzisiaj</button>
        <button type="button" className="btn-secondary" onClick={() => selectRange(7)}>Ostatnie 7 dni</button>
        <button type="button" className="btn-secondary" onClick={() => selectRange(30)}>Ostatnie 30 dni</button>
      </div>

      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}

      <div className="mt-5 grid gap-3">
        {visibleSummaries.map((summary) => {
          const normalizedRole = normalizeRole(summary.role, summary.email);
          return (
            <article key={summary.userId} className="rounded-lg border border-line bg-[#f9fbfd] p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black text-ink">{summary.fullName}</div>
                  <div className="text-xs text-muted">{summary.email}</div>
                </div>
                <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-muted">
                  {ROLE_LABELS[normalizedRole]}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-white p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    <Eye className="h-4 w-4 text-sky" /> Otwarte leady
                  </div>
                  <div className="mt-2 text-2xl font-black text-ink">{summary.openedLeads}</div>
                </div>
                <div className="rounded-lg border border-line bg-white p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    <Activity className="h-4 w-4 text-solar" /> Zmiany statusu
                  </div>
                  <div className="mt-2 text-2xl font-black text-ink">{summary.statusChanges}</div>
                </div>
                <div className="rounded-lg border border-line bg-white p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    <MessageSquareText className="h-4 w-4 text-leaf" /> Komentarze
                  </div>
                  <div className="mt-2 text-2xl font-black text-ink">{summary.comments}</div>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && visibleSummaries.length === 0 ? (
          <EmptyState
            title="Brak aktywności"
            description="W wybranym okresie nie znaleziono aktywności handlowców ani menadżerów."
          />
        ) : null}
      </div>
    </section>
  );
}

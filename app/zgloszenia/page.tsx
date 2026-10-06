"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

type SubmissionTask = {
  key: "zglosic_pge" | "zglosic_dotacje";
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  completedByName: string | null;
};

type SubmissionRow = {
  id: string;
  contract_number: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  city: string | null;
  street: string | null;
  house_number: string | null;
  created_at: string;
  submitted_at: string | null;
  process_status: string | null;
  pge: SubmissionTask;
  subsidy: SubmissionTask;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function addressFor(row: SubmissionRow) {
  return [
    [row.street, row.house_number].filter(Boolean).join(" "),
    [row.postal_code, row.city].filter(Boolean).join(" ")
  ]
    .filter(Boolean)
    .join(", ");
}

export default function SubmissionsPage() {
  const { loading, profile, session } = useAuth(["owner", "admin", "backoffice"]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"pending" | "all" | "complete">("pending");

  const loadSubmissions = useCallback(async () => {
    if (!session?.access_token) return;
    setDataLoading(true);
    setError("");

    const response = await fetch("/api/submissions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store"
    });
    const body = (await response.json().catch(() => ({}))) as {
      submissions?: SubmissionRow[];
      error?: string;
    };

    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać zgłoszeń.");
      setSubmissions([]);
    } else {
      setSubmissions(body.submissions || []);
    }
    setDataLoading(false);
  }, [session?.access_token]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function toggleTask(row: SubmissionRow, task: SubmissionTask) {
    if (!session?.access_token || busyKey) return;
    const key = `${row.id}:${task.key}`;
    setBusyKey(key);
    setError("");

    const response = await fetch("/api/submissions", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        contractId: row.id,
        taskKey: task.key,
        completed: !task.completed
      })
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać zgłoszenia.");
    } else {
      await loadSubmissions();
    }
    setBusyKey("");
  }

  const stats = useMemo(() => {
    const pendingPge = submissions.filter((row) => !row.pge.completed).length;
    const pendingSubsidy = submissions.filter((row) => !row.subsidy.completed).length;
    const complete = submissions.filter((row) => row.pge.completed && row.subsidy.completed).length;
    const pending = submissions.length - complete;
    return { pendingPge, pendingSubsidy, complete, pending };
  }, [submissions]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return submissions
      .filter((row) => {
        const complete = row.pge.completed && row.subsidy.completed;
        if (filter === "pending" && complete) return false;
        if (filter === "complete" && !complete) return false;
        if (!needle) return true;
        return [row.customer_name, row.contract_number, row.phone, row.city, row.postal_code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((left, right) => {
        const leftDone = Number(left.pge.completed) + Number(left.subsidy.completed);
        const rightDone = Number(right.pge.completed) + Number(right.subsidy.completed);
        if (leftDone !== rightDone) return leftDone - rightDone;
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      });
  }, [filter, search, submissions]);

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Zgłoszenia"
          description="Back-Office: PGE i dotacje. Umowa trafia tutaj automatycznie dopiero po oznaczeniu jej jako Rozliczona."
          actions={
            <button type="button" className="btn-secondary" onClick={() => void loadSubmissions()} disabled={dataLoading}>
              <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              Odśwież
            </button>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Do obsługi</div>
            <div className="mt-2 text-3xl font-black text-ink">{stats.pending}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">PGE do zgłoszenia</div>
            <div className="mt-2 text-3xl font-black text-ink">{stats.pendingPge}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Dotacje do zgłoszenia</div>
            <div className="mt-2 text-3xl font-black text-ink">{stats.pendingSubsidy}</div>
          </div>
          <div className="app-muted-panel">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Kompletne</div>
            <div className="mt-2 text-3xl font-black text-leaf">{stats.complete}</div>
          </div>
        </section>

        <section className="app-card">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px] lg:items-end">
            <label>
              <span className="label">Szukaj</span>
              <input
                className="field"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Klient, nr umowy, telefon, miejscowość..."
              />
            </label>
            <label>
              <span className="label">Widok</span>
              <select className="field" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="pending">Do zrobienia</option>
                <option value="all">Wszystkie</option>
                <option value="complete">Zakończone</option>
              </select>
            </label>
          </div>
        </section>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {dataLoading ? (
          <div className="app-card text-sm font-semibold text-muted">Ładowanie zgłoszeń…</div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={submissions.length === 0 ? "Brak zgłoszeń" : "Brak wyników"}
            description={
              submissions.length === 0
                ? "Po oznaczeniu umowy jako Rozliczona pojawią się tutaj zadania PGE i dotacyjne."
                : "Zmień filtr albo wyszukiwanie."
            }
          />
        ) : (
          <div className="grid gap-3">
            {visibleRows.map((row) => {
              const complete = row.pge.completed && row.subsidy.completed;
              return (
                <article key={row.id} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
                  <div className="grid gap-4 p-4 xl:grid-cols-[minmax(260px,1.2fr)_minmax(230px,1fr)_minmax(230px,1fr)] xl:items-stretch">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-black text-ink">{row.customer_name}</div>
                        <span className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-wide ${complete ? "border-leaf/20 bg-leaf/10 text-leaf" : "border-warn/20 bg-warn/10 text-warn"}`}>
                          {complete ? "Kompletne" : "Do obsługi"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-muted">Umowa: {row.contract_number}</div>
                      {addressFor(row) ? <div className="mt-3 text-sm text-muted">{addressFor(row)}</div> : null}
                      {row.phone ? <div className="mt-1 text-sm text-muted">Tel. {row.phone}</div> : null}
                      <div className="mt-3 text-xs text-muted">Rozliczona umowa · w kolejce zgłoszeń</div>
                    </div>

                    <TaskCard
                      title="Zgłoszenie PGE"
                      task={row.pge}
                      busy={busyKey === `${row.id}:${row.pge.key}`}
                      onToggle={() => void toggleTask(row, row.pge)}
                    />
                    <TaskCard
                      title="Zgłoszenie pod dotacje"
                      task={row.subsidy}
                      busy={busyKey === `${row.id}:${row.subsidy.key}`}
                      onToggle={() => void toggleTask(row, row.subsidy)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TaskCard({
  title,
  task,
  busy,
  onToggle
}: {
  title: string;
  task: SubmissionTask;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-lg border p-4 ${task.completed ? "border-leaf/20 bg-leaf/5" : "border-line bg-[#f9fbfd]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-ink">{title}</div>
          {task.completed ? (
            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-leaf">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Wykonane
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-warn">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Do zrobienia
            </div>
          )}
        </div>
      </div>

      {task.completed ? (
        <div className="mt-3 rounded-md border border-leaf/15 bg-white p-3 text-xs leading-5 text-muted">
          <div><span className="font-bold text-ink">Wykonał:</span> {task.completedByName || "Użytkownik"}</div>
          <div><span className="font-bold text-ink">Kiedy:</span> {formatDateTime(task.completedAt)}</div>
        </div>
      ) : null}

      <button
        type="button"
        className={task.completed ? "btn-secondary mt-3 w-full" : "btn-primary mt-3 w-full"}
        disabled={busy}
        onClick={onToggle}
      >
        {busy ? "Zapisywanie…" : task.completed ? "Cofnij wykonanie" : "Oznacz jako wykonane"}
      </button>
    </div>
  );
}

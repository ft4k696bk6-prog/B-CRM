"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Route, RotateCcw, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type WorkflowPerson = {
  id: string;
  full_name: string;
  role: UserRole;
  manager_id: string | null;
  auto_takeback_enabled: boolean;
};

type WorkflowResponse = {
  autoAssignmentEnabled: boolean;
  salespeople: WorkflowPerson[];
};

export default function WorkflowSettingsPage() {
  const { loading, profile, session } = useAuth(["owner", "admin"]);
  const [data, setData] = useState<WorkflowResponse | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setError("");
    const response = await fetch("/api/admin/workflow", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as WorkflowResponse & { error?: string };
    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać ustawień automatyzacji.");
      return;
    }
    setData(body);
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, key: string, success: string) {
    if (!session?.access_token) return;
    setBusyKey(key);
    setError("");
    setNotice("");

    const response = await fetch("/api/admin/workflow", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusyKey("");

    if (!response.ok) {
      setError(result.error || "Nie udało się zapisać ustawienia.");
      return;
    }

    setNotice(success);
    await load();
  }

  if (loading || !profile || !data) return <LoadingScreen label="Otwieranie automatyzacji leadów" />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Automatyzacja leadów"
          description="Sterowanie automatycznym przydzielaniem i nocnym zwrotem leadów."
          actions={
            <>
              <Link href="/admin/control" className="btn-secondary">Wróć do Kontroli</Link>
              <button type="button" className="btn-secondary" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />Odśwież
              </button>
            </>
          }
        />

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <section className="app-card">
          <SectionHeader
            icon={Route}
            title="Automatyczne przypisywanie nowych leadów"
            description="Reguły województw zostają zapisane. Ten przełącznik tylko włącza lub zatrzymuje automatyczny podział."
            tone="sky"
          />
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-black text-ink">Stan: {data.autoAssignmentEnabled ? "WŁĄCZONE" : "WYŁĄCZONE"}</div>
              <div className="mt-1 text-sm font-semibold text-muted">
                Domyślnie wyłączone. Włącz tylko wtedy, gdy chcesz, żeby nowe leady same trafiały według routingu województw.
              </div>
            </div>
            <button
              type="button"
              className={data.autoAssignmentEnabled ? "btn-secondary" : "btn-primary"}
              disabled={busyKey === "auto-assignment"}
              onClick={() => void patch(
                { action: "set_auto_assignment", enabled: !data.autoAssignmentEnabled },
                "auto-assignment",
                data.autoAssignmentEnabled ? "Wyłączono automatyczne przypisywanie." : "Włączono automatyczne przypisywanie.",
              )}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {busyKey === "auto-assignment" ? "Zapisywanie…" : data.autoAssignmentEnabled ? "Wyłącz" : "Włącz"}
            </button>
          </div>
        </section>

        <section className="app-card">
          <SectionHeader
            icon={RotateCcw}
            title="Automatyczny zwrot o 22:00"
            description="Domyślnie włączony per handlowiec/menadżer. Call-backi i spotkania nie są zabierane."
            tone="warn"
          />

          <div className="mb-4 rounded-xl border border-line bg-[#f8fafc] p-4 text-sm font-semibold text-muted">
            O 22:00 zwykłe leady wracają do puli jako <strong className="text-ink">Nowy</strong>. `Nie odebrał` również wraca jako `Nowy`. Call-backi, przyszłe spotkania i nierozliczone spotkania zostają u prowadzącego. Lead po nieodbytym spotkaniu zostaje do 22:00 jako `Nowy`.
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.salespeople.map((person) => {
              const enabled = person.auto_takeback_enabled;
              const key = `takeback:${person.id}`;
              return (
                <article key={person.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-black text-ink">{person.full_name}</div>
                      <div className="mt-1 text-xs font-semibold text-muted">{ROLE_LABELS[person.role]}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${enabled ? "border-leaf/25 bg-leaf/10 text-leaf" : "border-line bg-[#f2f4f7] text-muted"}`}>
                      {enabled ? "22:00 ON" : "22:00 OFF"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={enabled ? "btn-secondary mt-4 w-full" : "btn-primary mt-4 w-full"}
                    disabled={busyKey === key}
                    onClick={() => void patch(
                      { action: "set_takeback", profileId: person.id, enabled: !enabled },
                      key,
                      `${person.full_name}: automatyczny zwrot ${enabled ? "wyłączony" : "włączony"}.`,
                    )}
                  >
                    {busyKey === key ? "Zapisywanie…" : enabled ? "Wyłącz zabieranie" : "Włącz zabieranie"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

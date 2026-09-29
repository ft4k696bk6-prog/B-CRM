"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { canManageContractWorkflow, monthLabel, signingMonth } from "@/lib/contract-workflow";
import { useAuth } from "@/lib/use-auth";

const money = (amount: number) =>
  amount.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ContractsCommissions() {
  const { loading, profile, session } = useAuth();
  const [items, setItems] = useState<ContractRecord[]>([]);
  const [month, setMonth] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [error, setError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setDataLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contracts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Nie udało się pobrać prowizji.");
      setItems(body.contracts || []);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Nie udało się pobrać prowizji.",
      );
    } finally {
      setDataLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(
    () =>
      [...new Set(items.map((item) => signingMonth(item.signed_at)))]
        .filter((value) => value !== "unknown")
        .sort()
        .reverse(),
    [items],
  );

  const sellers = useMemo(
    () =>
      [
        ...new Map(
          items.map((item) => [
            item.created_by,
            item.creator?.full_name || "Nieprzypisane",
          ]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "pl")),
    [items],
  );

  const rows = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.submission_status === "submitted" &&
            (!month || signingMonth(item.signed_at) === month) &&
            (!salesperson || item.created_by === salesperson),
        )
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [items, month, salesperson],
  );

  const eligibleRows = useMemo(
    () => rows.filter((item) => item.archive_reason !== "resigned" && !item.commission_calc_error),
    [rows],
  );

  const totals = useMemo(
    () => ({
      gross: eligibleRows.reduce(
        (sum, item) => sum + (Number(item.gross_amount) || 0),
        0,
      ),
      net: eligibleRows.reduce(
        (sum, item) => sum + (Number(item.commission_sale_net) || 0),
        0,
      ),
      margin: eligibleRows.reduce(
        (sum, item) => sum + (Number(item.commission_margin_net) || 0),
        0,
      ),
      commission: eligibleRows.reduce(
        (sum, item) => sum + (Number(item.commission_amount) || 0),
        0,
      ),
      payable: eligibleRows
        .filter(
          (item) => item.workflow?.settled && !item.workflow?.commission_paid,
        )
        .reduce(
          (sum, item) => sum + (Number(item.commission_amount) || 0),
          0,
        ),
    }),
    [eligibleRows],
  );

  const sellerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        contracts: number;
        gross: number;
        net: number;
        margin: number;
        commission: number;
      }
    >();

    for (const item of eligibleRows) {
      const id = item.created_by || "unassigned";
      const current = map.get(id) || {
        id,
        name: item.creator?.full_name || "Nieprzypisane",
        contracts: 0,
        gross: 0,
        net: 0,
        margin: 0,
        commission: 0,
      };
      current.contracts += 1;
      current.gross += Number(item.gross_amount) || 0;
      current.net += Number(item.commission_sale_net) || 0;
      current.margin += Number(item.commission_margin_net) || 0;
      current.commission += Number(item.commission_amount) || 0;
      map.set(id, current);
    }

    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [eligibleRows]);

  if (loading || !profile) return <LoadingScreen />;
  if (!canManageContractWorkflow(profile.role))
    return (
      <AppShell profile={profile}>
        <Alert tone="danger">
          Ta zakładka jest dostępna tylko dla właściciela i administratorów.
        </Alert>
      </AppShell>
    );

  return (
    <AppShell profile={profile}>
      <div className="grid min-w-0 gap-5">
        <PageHeader
          title="Prowizje"
          description="Prowizja = (sprzedaż brutto / 1,08 − cena bazowa netto z kalkulatora) × % handlowca. Rezygnacje nie wchodzą do statystyk."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/users" className="btn-secondary">
                Ustaw % handlowców
              </Link>
              <Link href="/realizacja/umowy" className="btn-secondary">
                <ArrowLeft className="h-4 w-4" />
                Umowy
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void load()}
                disabled={dataLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`}
                />
                Odśwież
              </button>
            </div>
          }
        />

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <section className="app-card !p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">Miesiąc podpisania</span>
              <select className="field" value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="">Wszystkie miesiące</option>
                {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Handlowiec</span>
              <select className="field" value={salesperson} onChange={(event) => setSalesperson(event.target.value)}>
                <option value="">Wszyscy</option>
                {sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Umowy", String(eligibleRows.length)],
              ["Sprzedaż brutto", money(totals.gross)],
              ["Sprzedaż netto", money(totals.net)],
              ["Marża netto", money(totals.margin)],
              ["Prowizje", money(totals.commission)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-warn">
            Do wypłaty po rozliczeniu: {money(totals.payable)}
          </p>
        </section>

        <section className="app-card min-w-0 !p-0">
          <div className="border-b border-line p-4"><h2 className="font-black">Statystyki handlowców</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-[#f8fafc] text-xs text-muted">
                <tr><th className="px-4 py-3">Handlowiec</th><th className="px-3 py-3 text-right">Umowy</th><th className="px-3 py-3 text-right">Sprzedaż brutto</th><th className="px-3 py-3 text-right">Sprzedaż netto</th><th className="px-3 py-3 text-right">Marża</th><th className="px-3 py-3 text-right">Prowizja</th></tr>
              </thead>
              <tbody>
                {sellerStats.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3 font-bold">{item.name}</td><td className="px-3 py-3 text-right">{item.contracts}</td><td className="px-3 py-3 text-right">{money(item.gross)}</td><td className="px-3 py-3 text-right">{money(item.net)}</td><td className="px-3 py-3 text-right">{money(item.margin)}</td><td className="px-3 py-3 text-right font-black">{money(item.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="app-card min-w-0 !p-0">
          <div className="border-b border-line p-4"><h2 className="font-black">Umowy i prowizje</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-[#f8fafc] text-xs text-muted">
                <tr><th className="px-4 py-3">Handlowiec</th><th className="min-w-[190px] px-3 py-3">Klient</th><th className="px-3 py-3 text-right">Sprzedaż brutto</th><th className="px-3 py-3 text-right">Sprzedaż netto</th><th className="px-3 py-3 text-right">Bazowa netto</th><th className="px-3 py-3 text-right">Marża</th><th className="px-3 py-3 text-right">%</th><th className="px-3 py-3 text-right">Prowizja</th></tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className={`border-b border-line last:border-b-0 ${item.archive_reason === "resigned" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">{item.creator?.full_name || "Nieprzypisane"}</td>
                    <td className="px-3 py-3">
                      <Link href={`/realizacja/${item.id}`} className="font-bold text-ink hover:text-sky hover:underline">{item.customer_name}</Link>
                      <p className="text-xs text-muted">{item.contract_number}</p>
                      {item.commission_calc_error ? <p className="mt-1 max-w-[320px] text-xs font-semibold text-warn">{item.commission_calc_error}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{money(Number(item.gross_amount) || 0)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{money(Number(item.commission_sale_net) || 0)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{item.commission_base_net == null ? "—" : money(Number(item.commission_base_net) || 0)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{item.commission_calc_error ? "—" : money(Number(item.commission_margin_net) || 0)}</td>
                    <td className="px-3 py-3 text-right">{Number(item.commission_percent) || 0}%</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-black">{item.archive_reason === "resigned" ? "Anulowana" : item.commission_calc_error ? "—" : money(Number(item.commission_amount) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dataLoading && !items.length ? <div className="p-5"><LoadingScreen label="Pobieranie prowizji" /></div> : !rows.length ? <div className="p-5"><EmptyState title="Brak prowizji w tym filtrze" description="Zmień miesiąc lub handlowca." /></div> : null}
        </section>
      </div>
    </AppShell>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileDigit,
  FileSignature,
  FileSpreadsheet,
  FolderKanban,
  Hammer,
  PackageCheck,
  ReceiptText,
  Sparkles,
  Truck,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import {
  annexChangeOptions,
  demoContractData,
  demoCreditData,
  ksefDisclaimer
} from "@/lib/demo-documents";
import { canUseOperations, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type WorkflowStatus = "pending" | "active" | "done";

const initialWorkflow = {
  sales: "done" as WorkflowStatus,
  manager: "active" as WorkflowStatus,
  accounting: "pending" as WorkflowStatus,
  logistics: "pending" as WorkflowStatus,
  installer: "pending" as WorkflowStatus
};

const workflowSteps = [
  { key: "sales", label: "Handlowiec", ownerRole: "handlowiec", icon: FileSignature },
  { key: "manager", label: "Menadżer", ownerRole: "menadzer", icon: UsersRound },
  { key: "accounting", label: "Księgowość", ownerRole: "ksiegowosc", icon: Calculator },
  { key: "logistics", label: "Logistyka", ownerRole: "logistyk", icon: Truck },
  { key: "installer", label: "Monter", ownerRole: "monter", icon: Hammer }
] as const;

type WorkflowKey = (typeof workflowSteps)[number]["key"];

function statusClasses(status: WorkflowStatus) {
  if (status === "done") return "border-leaf/25 bg-leaf/10 text-leaf";
  if (status === "active") return "border-sky/25 bg-sky/10 text-sky";
  return "border-line bg-white text-muted";
}

function statusLabel(status: WorkflowStatus) {
  if (status === "done") return "Wykonane";
  if (status === "active") return "Do akcji";
  return "Czeka";
}

function canControlStep(role: UserRole, ownerRole: UserRole) {
  return role === "admin" || role === ownerRole;
}

function canUseAccountingTools(role: UserRole) {
  return role === "admin" || role === "ksiegowosc";
}

export default function RealizacjaPage() {
  const { loading, profile } = useAuth([
    "admin",
    "menadzer",
    "handlowiec",
    "ksiegowosc",
    "logistyk",
    "monter"
  ]);
  const [contractLoaded, setContractLoaded] = useState(false);
  const [creditLoaded, setCreditLoaded] = useState(false);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [ksefReady, setKsefReady] = useState(false);
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [annexMode, setAnnexMode] = useState<"manual" | "automatic">("automatic");
  const [selectedChanges, setSelectedChanges] = useState<string[]>([
    "Zmiana liczby paneli",
    "Zmiana finansowania"
  ]);
  const [annexValues, setAnnexValues] = useState({
    panelsCount: "26",
    installationPowerKw: "10.66",
    grossPrice: "41 920 PLN",
    financing: "30% gotówka / 70% kredyt"
  });

  const currentRoleLabel = profile ? ROLE_LABELS[profile.role] : "";
  const accountingToolsAllowed = profile ? canUseAccountingTools(profile.role) : false;

  const completion = useMemo(() => {
    const values = Object.values(workflow);
    return Math.round((values.filter((value) => value === "done").length / values.length) * 100);
  }, [workflow]);

  if (loading || !profile) return <LoadingScreen />;
  if (!canUseOperations(profile.role)) return <LoadingScreen />;

  function toggleChange(option: string) {
    setSelectedChanges((current) =>
      current.includes(option) ? current.filter((value) => value !== option) : [...current, option]
    );
  }

  function moveWorkflow(step: WorkflowKey) {
    setWorkflow((current) => {
      const next = { ...current };
      next[step] = next[step] === "done" ? "active" : "done";
      return next;
    });
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Realizacja po umowie
              </div>
              <h1 className="section-title">Panel realizacji</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted">
                Jedno miejsce dla handlowca, menadżera, księgowości, logistyki i montera.
                Demo pokazuje pełen przepływ na gotowych dokumentach, bez ręcznego wrzucania PDF przez rekrutera.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-line bg-[#f8fafc] px-4 py-3 text-sm sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Zalogowana rola</span>
                <span className="font-bold text-ink">{currentRoleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Postęp realizacji</span>
                <span className="font-bold text-ink">{completion}%</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/10 text-sky">
                <FolderKanban className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Start demo</h2>
                <p className="mt-1 text-sm text-muted">
                  Ładujemy gotowe dokumenty i od razu pokazujemy, co system z nich odczytał.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setContractLoaded(true)} className="btn-primary">
                <FileSignature className="h-4 w-4" aria-hidden="true" />
                Wczytaj umowę demo
              </button>
              <button type="button" onClick={() => setCreditLoaded(true)} className="btn-secondary">
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Wczytaj wniosek kredytowy
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-[#f9fbfd] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                  <CheckCircle2 className="h-4 w-4 text-leaf" aria-hidden="true" />
                  Umowa
                </div>
                <div className="text-sm text-muted">
                  {contractLoaded ? "Dane klienta i parametry instalacji gotowe." : "Kliknij, aby załadować demo."}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-[#f9fbfd] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                  <CheckCircle2 className="h-4 w-4 text-leaf" aria-hidden="true" />
                  Finansowanie
                </div>
                <div className="text-sm text-muted">
                  {creditLoaded ? "Wniosek kredytowy i rata klienta są gotowe." : "Kliknij, aby załadować demo."}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf/10 text-leaf">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Workflow działów</h2>
                <p className="mt-1 text-sm text-muted">Prosty przepływ bez przeładowania systemu.</p>
              </div>
            </div>

            <div className="grid gap-3">
              {workflowSteps.map((item) => {
                const Icon = item.icon;
                const workflowKey = item.key;
                const canControl = canControlStep(profile.role, item.ownerRole);
                const status = workflow[workflowKey];

                return (
                  <div
                    key={item.key}
                    className={`grid gap-3 rounded-xl border px-4 py-3 transition sm:grid-cols-[1fr_auto] sm:items-center ${statusClasses(
                      status
                    )}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{item.label}</span>
                        <span className="block text-xs">
                          {statusLabel(status)} · {ROLE_LABELS[item.ownerRole]}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => moveWorkflow(workflowKey)}
                      disabled={!canControl}
                      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                        canControl
                          ? "bg-white text-ink shadow-sm hover:border hover:border-ink"
                          : "cursor-not-allowed border border-line bg-white/40 text-muted opacity-70"
                      }`}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {status === "done" ? "Cofnij" : "Oznacz"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {contractLoaded ? (
          <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-ink">Dane odczytane z umowy</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(demoContractData).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-line bg-[#f9fbfd] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">{key}</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-solar/15 text-[#aa6f00]">
                    <ReceiptText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-ink">Faktura demo</h2>
                    <p className="mt-1 text-sm text-muted">
                      Układ przygotowany pod szybki podgląd, w stylu prostego narzędzia księgowego.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-[#fbfcfe] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Sprzedawca</div>
                      <div className="mt-1 text-sm font-bold text-ink">B-CRM Energy Sp. z o.o.</div>
                      <div className="text-sm text-muted">NIP 948-000-00-00</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Dokument</div>
                      <div className="mt-1 text-sm font-bold text-ink">FV/05/2026/017</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Nabywca</div>
                      <div className="mt-1 text-sm font-bold text-ink">{demoContractData.clientName}</div>
                      <div className="text-sm text-muted">
                        {demoContractData.address}, {demoContractData.postalCode} {demoContractData.city}
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Kwota</div>
                      <div className="mt-1 text-sm font-bold text-ink">{demoContractData.grossPrice}</div>
                      <div className="text-sm text-muted">Netto: {demoContractData.netPrice}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInvoiceReady(true)}
                    disabled={!accountingToolsAllowed}
                    className="btn-primary mt-4"
                  >
                    <ReceiptText className="h-4 w-4" aria-hidden="true" />
                    {invoiceReady ? "Faktura gotowa" : accountingToolsAllowed ? "Wygeneruj fakturę" : "Księgowość"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/10 text-sky">
                    <FileDigit className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-ink">KSeF</h2>
                    <p className="mt-1 text-sm text-muted">
                      Symulacja gotowa do portfolio, bez ryzyka obiecywania produkcyjnej integracji.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-[#f9fbfd] p-4 text-sm text-muted">
                  {ksefDisclaimer}
                </div>

                <button
                  type="button"
                  onClick={() => setKsefReady(true)}
                  disabled={!accountingToolsAllowed}
                  className="btn-secondary mt-4"
                >
                  <FileDigit className="h-4 w-4" aria-hidden="true" />
                  {ksefReady ? "Pakiet gotowy do wysyłki demo" : accountingToolsAllowed ? "Przygotuj paczkę KSeF" : "Księgowość"}
                </button>
              </section>
            </div>
          </section>
        ) : null}

        {creditLoaded ? (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-ink">Wniosek kredytowy</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(demoCreditData).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-line bg-[#f9fbfd] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{key}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf/10 text-leaf">
                <FileSignature className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">Generator aneksu</h2>
                <p className="mt-1 text-sm text-muted">
                  Księgowość może wybrać tryb ręczny albo automatyczny i od razu wskazać, co się zmienia.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAnnexMode("automatic")}
                disabled={!accountingToolsAllowed}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  annexMode === "automatic" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
                }`}
              >
                Tryb automatyczny
              </button>
              <button
                type="button"
                onClick={() => setAnnexMode("manual")}
                disabled={!accountingToolsAllowed}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  annexMode === "manual" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
                }`}
              >
                Tryb ręczny
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {annexChangeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleChange(option)}
                  disabled={!accountingToolsAllowed}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                    selectedChanges.includes(option)
                      ? "border-leaf/30 bg-leaf/10 text-leaf"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  {option}
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-ink">Podgląd zmian w aneksie</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Liczba paneli</span>
                <input
                  className="field"
                  value={annexValues.panelsCount}
                  disabled={!accountingToolsAllowed}
                  onChange={(event) =>
                    setAnnexValues((current) => ({ ...current, panelsCount: event.target.value }))
                  }
                />
              </label>
              <label>
                <span className="label">Moc instalacji</span>
                <input
                  className="field"
                  value={annexValues.installationPowerKw}
                  disabled={!accountingToolsAllowed}
                  onChange={(event) =>
                    setAnnexValues((current) => ({
                      ...current,
                      installationPowerKw: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                <span className="label">Cena brutto</span>
                <input
                  className="field"
                  value={annexValues.grossPrice}
                  disabled={!accountingToolsAllowed}
                  onChange={(event) =>
                    setAnnexValues((current) => ({ ...current, grossPrice: event.target.value }))
                  }
                />
              </label>
              <label>
                <span className="label">Finansowanie</span>
                <input
                  className="field"
                  value={annexValues.financing}
                  disabled={!accountingToolsAllowed}
                  onChange={(event) =>
                    setAnnexValues((current) => ({ ...current, financing: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-[#f9fbfd] p-4 text-sm text-muted">
              <div className="font-semibold text-ink">Tryb: {annexMode === "automatic" ? "automatyczny" : "ręczny"}</div>
              <div className="mt-2">Zmiany do wpisania: {selectedChanges.join(", ") || "brak wybranych zmian"}</div>
              <div className="mt-2">
                Nowa konfiguracja: {annexValues.panelsCount} paneli, {annexValues.installationPowerKw} kW,
                {` `}{annexValues.grossPrice}, {annexValues.financing}.
              </div>
            </div>

            <button type="button" disabled={!accountingToolsAllowed} className="btn-primary mt-4">
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              {accountingToolsAllowed ? "Generuj aneks" : "Księgowość"}
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <UsersRound className="h-4 w-4 text-sky" aria-hidden="true" />
              Menadżer
            </div>
            <p className="text-sm text-muted">
              Widzi gotową paczkę po umowie i jednym kliknięciem akceptuje przejście do realizacji.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <PackageCheck className="h-4 w-4 text-solar" aria-hidden="true" />
              Logistyka
            </div>
            <p className="text-sm text-muted">
              Dostaje komplet: moc, liczba paneli, sprzęt, uwagi magazynowe i termin montażu.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <Hammer className="h-4 w-4 text-leaf" aria-hidden="true" />
              Monter
            </div>
            <p className="text-sm text-muted">
              Wchodzi na gotowy rekord z adresem, terminem i specyfikacją bez przepisywania danych ręcznie.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

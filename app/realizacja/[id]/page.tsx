"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  FileSignature,
  MessageSquarePlus,
  Undo2,
  XCircle
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContractAttachments } from "@/components/contract-attachments";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import {
  CONTRACT_STATUSES,
  contractDisplayStatus,
  contractProgress,
  contractStatusLabel,
  type ContractRecord,
  type ContractStatus
} from "@/lib/contracts";
import { useAuth } from "@/lib/use-auth";

const next: Partial<Record<ContractStatus, ContractStatus>> = {
  incomplete: "verification",
  verification: "equipment_to_order",
  equipment_to_order: "installation_to_schedule",
  installation_to_schedule: "installation_scheduled",
  installation_scheduled: "installation_confirmation",
  installation_confirmation: "settlement",
  settlement: "settled"
};

const previous: Partial<Record<ContractStatus, ContractStatus>> = {
  verification: "incomplete",
  equipment_to_order: "verification",
  installation_to_schedule: "equipment_to_order",
  installation_scheduled: "installation_to_schedule",
  installation_confirmation: "installation_scheduled",
  settlement: "installation_confirmation",
  settled: "settlement"
};

function commissionText(contract: ContractRecord) {
  return `${Number(contract.commission_amount || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} zł (${Number(contract.commission_percent || 0).toLocaleString("pl-PL")}% z ${Number(
    contract.commission_margin_net || 0
  ).toLocaleString("pl-PL")} zł marży)`;
}

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { loading, profile, session } = useAuth();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [contractLoading, setContractLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [date, setDate] = useState("");
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  async function load() {
    if (!session) return;
    setContractLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts?id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.contract) {
        setContract(body.contract);
        setDate(body.contract.installation_at?.slice(0, 16) || "");
      } else {
        setContract(null);
        setError(body.error || "Nie znaleziono umowy albo nie masz do niej dostępu.");
      }
    } catch {
      setContract(null);
      setError("Nie udało się pobrać umowy. Spróbuj ponownie.");
    } finally {
      setContractLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.access_token, id]);

  async function patch(data: Record<string, unknown>) {
    if (!session) return;
    setError("");
    const response = await fetch("/api/contracts", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id, ...data })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.contract) {
      setContract(body.contract);
      setNote("");
      setPrivateNote("");
    } else {
      setError(body.error || "Nie udało się zapisać zmian w umowie.");
    }
  }

  if (loading || !profile || contractLoading) return <LoadingScreen />;

  if (!contract) {
    return (
      <AppShell profile={profile}>
        <div className="grid gap-5">
          <PageHeader title="Umowa" description="Nie udało się otworzyć wskazanej umowy." />
          <Alert tone="danger">{error || "Nie znaleziono umowy."}</Alert>
          <div>
            <Link href="/realizacja/umowy" className="btn-secondary">
              Wróć do umów
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const isSalesperson = profile.role === "handlowiec";
  const canManageProcess = ["owner", "admin", "menadzer"].includes(profile.role);
  const canEditDetails =
    canManageProcess ||
    (isSalesperson && contract.created_by === profile.id && contract.submission_status === "draft");
  const canManageAttachments =
    ["owner", "admin"].includes(profile.role) ||
    (profile.role === "menadzer" &&
      contract.submission_status === "submitted" &&
      contract.creator?.manager_id === profile.id);
  const canViewCommission = ["owner", "admin", "menadzer", "finance", "ksiegowosc"].includes(
    profile.role
  );
  const status = contract.process_status || "verification";

  if (isSalesperson) {
    return (
      <AppShell profile={profile}>
        <div className="grid gap-5">
          <PageHeader
            title="Moja umowa"
            description="Klient i aktualny etap realizacji."
            actions={
              canEditDetails ? (
                <Link className="btn-primary" href={`/realizacja/nowa?contractId=${contract.id}`}>
                  Uzupełnij wersję roboczą
                </Link>
              ) : undefined
            }
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <section className="app-card">
            <SectionHeader
              icon={FileSignature}
              title={contract.customer_name}
              description={contract.contract_number}
              tone={contract.submission_status === "draft" ? "warn" : "leaf"}
            />
            <div className="rounded-lg border border-line bg-[#f8fafc] p-4">
              <div className="label">Status</div>
              <div className="mt-1 text-lg font-black text-ink">{contractDisplayStatus(contract)}</div>
            </div>
            <div className="mt-3 rounded-lg border border-leaf/20 bg-leaf/10 p-4">
              <div className="label">Finalna prowizja do wypłaty</div>
              <div className="mt-1 text-lg font-black text-ink">
                {Number(contract.commission_amount || 0).toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })} zł
              </div>
              <div className="text-xs text-muted">
                {Number(contract.commission_percent || 0).toLocaleString("pl-PL")}% z{" "}
                {Number(contract.commission_margin_net || 0).toLocaleString("pl-PL")} zł marży
              </div>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  const detailRows: Array<[string, string]> = [
    ["Telefon", contract.phone],
    ["E-mail", contract.email || "—"],
    ["Sprzedano", contract.product_type],
    ["Kwota brutto", `${Number(contract.gross_amount).toLocaleString("pl-PL")} zł`],
    ["Adres", `${contract.street} ${contract.house_number}, ${contract.postal_code} ${contract.city}`],
    ["Montaż", contract.installation_at ? new Date(contract.installation_at).toLocaleString("pl-PL") : "—"]
  ];
  if (canViewCommission) detailRows.splice(4, 0, ["Prowizja handlowca", commissionText(contract)]);

  const equipmentRows: Array<[string, string]> = [
    ["Zestaw", contract.product_type],
    ["Moc PV", contract.pv_power_kwp ? `${contract.pv_power_kwp} kWp` : "—"],
    ["Magazyn", contract.storage_capacity_kwh ? `${contract.storage_capacity_kwh} kWh` : "—"],
    [
      "Panele",
      contract.panels_count ? `${contract.panels_count} szt. × ${contract.panel_power_wp} Wp` : "—"
    ],
    ["Falownik", contract.has_inverter ? `${contract.inverter_power_kw || "—"} kW` : "Bez falownika"],
    ["Montaż", contract.mounting_locations?.join(", ") || "—"],
    ["Optymalizatory", String(contract.optimizer_count || 0)],
    ["Back-up", contract.backup_power ? "Tak" : "Nie"],
    ["Ochrona przepięciowa", contract.surge_protection ? "Tak" : "Nie"],
    ["Uziemienie", contract.grounding ? "Tak" : "Nie"]
  ];

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title={`${contract.customer_name} — ${contract.contract_number}`}
          description={`${contractStatusLabel(status)} · ${contractProgress(contract)}%`}
          actions={
            <div className="flex flex-wrap gap-2">
              <ContractAttachments
                contract={contract}
                accessToken={session?.access_token || ""}
                mode="viewer"
              />
              {canManageAttachments ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAttachmentsOpen(true)}
                >
                  Dodaj załączniki
                </button>
              ) : null}
              {canEditDetails ? (
                <Link className="btn-primary" href={`/realizacja/nowa?contractId=${contract.id}`}>
                  Edytuj dane i załączniki
                </Link>
              ) : null}
            </div>
          }
        />

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <section className="app-card">
          <SectionHeader icon={FileSignature} title="Dane umowy" tone="sky" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {detailRows.map(([label, value]) => (
              <div key={label}>
                <div className="label">{label}</div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card">
          <SectionHeader
            icon={FileSignature}
            title="Sprzęt do zamówienia"
            description="Komplet danych technicznych z umowy."
            tone="solar"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {equipmentRows.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-[#f8fafc] p-3">
                <div className="label">{label}</div>
                <div className="font-black text-ink">{value}</div>
              </div>
            ))}
          </div>
          {contract.additional_notes ? (
            <div className="mt-4 rounded-lg border border-solar/20 bg-solar/10 p-4">
              <div className="label">Uwagi do zamówienia</div>
              <p className="whitespace-pre-wrap">{contract.additional_notes}</p>
            </div>
          ) : null}
        </section>

        <section className="app-card">
          <SectionHeader
            icon={CheckCircle2}
            title="Proces realizacji"
            description={
              canManageProcess
                ? "Aktualny etap i sterowanie procesem umowy."
                : "Aktualny etap realizacji umowy. Zmiany etapu wykonuje kierownictwo."
            }
            tone="leaf"
          />
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-[900px] items-start">
              {CONTRACT_STATUSES.filter(
                ([key]) => !["incomplete", "resigned", "paused"].includes(key)
              ).map(([key, label], index, items) => {
                const keys = items.map((item) => item[0]);
                const current = keys.indexOf(status);
                const done = index < current || status === "settled";
                const selected = index === current;
                return (
                  <div key={key} className="flex flex-1 items-start">
                    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black ${
                          done
                            ? "border-leaf bg-leaf text-white"
                            : selected
                              ? "border-sky bg-sky text-white"
                              : "border-line bg-white text-muted"
                        }`}
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      <span className={`mt-2 text-xs font-bold ${selected ? "text-sky" : "text-muted"}`}>
                        {label}
                      </span>
                    </div>
                    {index < items.length - 1 ? (
                      <span className={`mt-4 h-1 flex-1 ${index < current ? "bg-leaf" : "bg-line"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {canManageProcess ? (
            <>
              <div className="mt-4 flex flex-wrap gap-3">
                {previous[status] ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => patch({ process_status: previous[status], installation_at: null })}
                  >
                    <Undo2 className="h-4 w-4" />
                    Cofnij: {contractStatusLabel(previous[status])}
                  </button>
                ) : null}
                {next[status] ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      patch({
                        process_status: next[status],
                        installation_at:
                          status === "installation_to_schedule" && date
                            ? new Date(date).toISOString()
                            : undefined
                      })
                    }
                  >
                    Przejdź: {contractStatusLabel(next[status])}
                  </button>
                ) : null}
                {status === "installation_confirmation" ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => patch({ process_status: "installation_to_schedule", note })}
                  >
                    Montaż niewykonany
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary text-danger"
                  onClick={() => patch({ process_status: "resigned", note })}
                >
                  <XCircle className="h-4 w-4" />
                  Rezygnacja
                </button>
              </div>

              {["installation_to_schedule", "installation_scheduled"].includes(status) ? (
                <label className="mt-4 block max-w-sm">
                  <span className="label">Termin montażu</span>
                  <input
                    className="field"
                    type="datetime-local"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
              ) : null}

              <label className="mt-4 block">
                <span className="label">Notatka do zmiany / rezygnacji</span>
                <textarea className="field" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </>
          ) : null}
        </section>

        <section className="app-card">
          <SectionHeader
            icon={MessageSquarePlus}
            title="Notatki kierownictwa i realizacji"
            description={
              canManageProcess
                ? "Wewnętrzne notatki niewidoczne dla handlowca."
                : "Wewnętrzne notatki do tej umowy. Edycja jest ograniczona do kierownictwa."
            }
            tone="solar"
          />
          <div className="mt-4 space-y-2">
            {(contract.management_notes || []).map((item) => (
              <div key={item.id} className="rounded-lg border border-line p-3">
                <b>{item.author}</b>
                <p>{item.content}</p>
                <small>{new Date(item.created_at).toLocaleString("pl-PL")}</small>
              </div>
            ))}
          </div>
          {canManageProcess ? (
            <>
              <textarea
                className="field mt-4"
                value={privateNote}
                onChange={(event) => setPrivateNote(event.target.value)}
                placeholder="Dodaj prywatną notatkę"
              />
              <button
                type="button"
                className="btn-primary mt-3"
                disabled={!privateNote.trim()}
                onClick={() => patch({ management_note: privateNote })}
              >
                Dodaj notatkę
              </button>
            </>
          ) : null}
        </section>

        {attachmentsOpen && canManageAttachments ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
            onClick={() => setAttachmentsOpen(false)}
          >
            <div
              className="relative w-full max-w-5xl rounded-xl bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="btn-icon absolute right-3 top-3"
                onClick={() => setAttachmentsOpen(false)}
                aria-label="Zamknij"
              >
                <XCircle className="h-5 w-5" />
              </button>
              <h2 className="mb-4 text-xl font-black">Dodaj załączniki do umowy</h2>
              <ContractAttachments
                contract={contract}
                accessToken={session?.access_token || ""}
                mode="manage"
                onUploaded={(files) =>
                  setContract((current) =>
                    current
                      ? { ...current, files: [...(current.files || []), ...files] }
                      : current
                  )
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

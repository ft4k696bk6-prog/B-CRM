"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  FileSignature,
  MapPin,
  MessageSquarePlus,
  RotateCcw,
  Save,
  UserCheck
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { RegionFields } from "@/components/region-fields";
import { StatusBadge } from "@/components/status-badge";
import { ACTION_LABELS, LEAD_STATUSES, STATUS_TILE_TONES } from "@/lib/constants";
import { formatDateTime, toDatetimeLocalValue } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadHistory, LeadStatus, Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function getSalesStatusPath(lead: Lead): LeadStatus[] {
  if (lead.status === "Umowa") return ["Umowa"];
  if (lead.status === "Zwrot") return ["Zwrot"];
  if (lead.status === "Rezygnacja") return ["Rezygnacja"];

  const base: LeadStatus[] = [
    "Call back",
    "Spotkanie",
    "Rezygnacja",
    "Zwrot",
    "Nie odebrał",
    "Błędny numer",
    "Do weryfikacji"
  ];

  if (lead.status === "Spotkanie") {
    return ["Spotkanie", "Umowa", "Call back", "Rezygnacja", "Zwrot", "Nie odebrał"];
  }

  return base.includes(lead.status) ? base : [lead.status, ...base];
}

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading, profile } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [status, setStatus] = useState<LeadStatus>("Nowy");
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingAddress, setMeetingAddress] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [resignationReason, setResignationReason] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [county, setCounty] = useState("");
  const [comment, setComment] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = profile?.role === "admin";
  const backHref = isAdmin ? "/admin" : "/sales";

  async function loadLead() {
    if (!params.id) return;

    setBusy(true);
    setError("");

    const { data, error: leadError } = await supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role)")
      .eq("id", params.id)
      .single();

    if (leadError || !data) {
      setError("Nie znaleziono leada albo nie masz do niego dostępu.");
      setBusy(false);
      return;
    }

    const nextLead = data as Lead;
    setLead(nextLead);
    setStatus(nextLead.status);
    setCallbackAt(toDatetimeLocalValue(nextLead.callback_at));
    setMeetingAt(toDatetimeLocalValue(nextLead.meeting_at));
    setMeetingAddress(nextLead.meeting_address || nextLead.address || "");
    setContractNumber(nextLead.contract_number || "");
    setResignationReason(nextLead.resignation_reason || "");
    setPostalCode(nextLead.postal_code || "");
    setAddress(nextLead.address || "");
    setVoivodeship(nextLead.voivodeship || "");
    setCounty(nextLead.county || "");
    setSelectedAssignee(nextLead.assigned_to || "");

    await supabase
      .from("leads")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", params.id);

    setBusy(false);
  }

  async function loadHistory() {
    if (!params.id) return;

    const { data } = await supabase
      .from("lead_history")
      .select("*, user_profile:profiles!lead_history_user_id_fkey(id,email,full_name,role)")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false })
      .limit(200);

    setHistory((data || []) as LeadHistory[]);
  }

  async function loadSalespeople() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "sales")
      .order("full_name", { ascending: true });

    setSalespeople((data || []) as Profile[]);
  }

  useEffect(() => {
    if (!profile) return;
    loadLead();
    loadHistory();
    if (profile.role === "admin") loadSalespeople();
  }, [profile, params.id]);

  async function refresh() {
    await Promise.all([loadLead(), loadHistory()]);
  }

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;

    setBusy(true);
    setError("");

    const patch: Partial<Lead> = { status };
    const availableStatuses = isAdmin ? LEAD_STATUSES : getSalesStatusPath(lead);

    if (!availableStatuses.includes(status)) {
      setError("Ten status nie jest dostępny na obecnym etapie leada.");
      setBusy(false);
      return;
    }

    if (status === "Call back") {
      if (!callbackAt) {
        setError("Wybierz datę i godzinę callbacku.");
        setBusy(false);
        return;
      }
      patch.callback_at = new Date(callbackAt).toISOString();
    }

    if (status === "Spotkanie") {
      if (!meetingAt || !meetingAddress.trim()) {
        setError("Wybierz termin spotkania i wpisz adres klienta.");
        setBusy(false);
        return;
      }
      patch.meeting_at = new Date(meetingAt).toISOString();
      patch.meeting_address = meetingAddress.trim();
      patch.address = meetingAddress.trim();
    }

    if (status === "Rezygnacja") {
      if (!resignationReason.trim()) {
        setError("Wpisz powód rezygnacji.");
        setBusy(false);
        return;
      }
      patch.resignation_reason = resignationReason.trim();
    }

    if (status === "Umowa") {
      if (!isAdmin && lead.status !== "Spotkanie" && lead.status !== "Umowa") {
        setError("Umowę można oznaczyć dopiero po statusie Spotkanie.");
        setBusy(false);
        return;
      }

      if (!contractNumber.trim()) {
        setError("Wpisz numer umowy.");
        setBusy(false);
        return;
      }

      patch.contract_number = contractNumber.trim();
    }

    if (status === "Zwrot") {
      patch.assigned_to = null;
    }

    const { error: updateError } = await supabase.from("leads").update(patch).eq("id", lead.id);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    if (status === "Zwrot" && profile?.role === "sales") {
      router.replace("/sales");
      return;
    }

    await refresh();
    setBusy(false);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !profile || !comment.trim()) return;

    setBusy(true);
    setError("");

    const { error: commentError } = await supabase.from("lead_history").insert({
      lead_id: lead.id,
      user_id: profile.id,
      action_type: "comment",
      description: comment.trim()
    });

    if (commentError) {
      setError(commentError.message);
    } else {
      setComment("");
      await loadHistory();
    }

    setBusy(false);
  }

  async function saveLeadData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;

    setBusy(true);
    setError("");

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        postal_code: postalCode.trim() || null,
        address: address.trim() || null,
        voivodeship: voivodeship || null,
        county: county || null
      })
      .eq("id", lead.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await refresh();
    }

    setBusy(false);
  }

  async function returnLead() {
    if (!lead) return;

    setBusy(true);
    setError("");

    const { error: returnError } = await supabase
      .from("leads")
      .update({
        status: "Zwrot",
        assigned_to: null
      })
      .eq("id", lead.id);

    if (returnError) {
      setError(returnError.message);
      setBusy(false);
      return;
    }

    if (profile?.role === "sales") {
      router.replace("/sales");
    } else {
      await refresh();
      setBusy(false);
    }
  }

  async function assignLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !isAdmin) return;

    setBusy(true);
    setError("");

    const { error: assignError } = await supabase
      .from("leads")
      .update({
        assigned_to: selectedAssignee || null,
        status: selectedAssignee ? "Przypisany" : "Nowy"
      })
      .eq("id", lead.id);

    if (assignError) {
      setError(assignError.message);
    } else {
      await refresh();
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;
  const availableStatuses = lead ? (isAdmin ? LEAD_STATUSES : getSalesStatusPath(lead)) : [];

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={backHref} className="btn-secondary w-fit">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Wróć
          </Link>
          {lead ? <StatusBadge status={lead.status} /> : null}
        </div>

        {error ? (
          <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}

        {!lead ? (
          <LoadingScreen label={busy ? "Ładowanie leada" : "Brak danych"} />
        ) : (
          <>
            <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-ink">{lead.full_name}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                    <span>{lead.phone}</span>
                    <span>·</span>
                    <span>{lead.postal_code || "brak kodu"}</span>
                    <span>·</span>
                    <span>{lead.source || "bez źródła"}</span>
                  </div>
                </div>
                <a href={`tel:${lead.phone}`} className="btn-primary">
                  Zadzwoń
                </a>
              </div>

              {lead.status === "Umowa" ? (
                <div className="mt-5 rounded-lg border border-[#9bd7a1] bg-[#e9f8eb] p-4 text-[#23682e]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2f8f3c] text-white">
                      <FileSignature className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-wide">Umowa</div>
                      <div className="text-lg font-black">
                        {lead.contract_number || "Brak numeru umowy"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Adres</dt>
                  <dd className="text-sm font-semibold text-ink">{lead.address || "—"}</dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Region</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lead.voivodeship || "—"} / {lead.county || "—"}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Handlowiec</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lead.assigned_profile?.full_name || "Nieprzypisany"}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Ostatnie otwarcie</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateTime(lead.last_opened_at)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Dodany</dt>
                  <dd className="text-sm font-semibold text-ink">{formatDateTime(lead.created_at)}</dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Modyfikacja</dt>
                  <dd className="text-sm font-semibold text-ink">{formatDateTime(lead.updated_at)}</dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Callback</dt>
                  <dd className="text-sm font-semibold text-ink">{formatDateTime(lead.callback_at)}</dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Spotkanie</dt>
                  <dd className="text-sm font-semibold text-ink">{formatDateTime(lead.meeting_at)}</dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Numer umowy</dt>
                  <dd className="text-sm font-semibold text-ink">{lead.contract_number || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={saveStatus} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Status i terminy</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className="label">Status</span>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {availableStatuses.map((item) => {
                        const active = status === item;

                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setStatus(item)}
                            className={`min-h-20 rounded-lg border p-3 text-left transition ${
                              STATUS_TILE_TONES[item]
                            } ${active ? "ring-2 ring-ink ring-offset-2" : ""}`}
                          >
                            <span className="block text-sm font-black">{item}</span>
                            <span className="mt-1 block text-xs opacity-80">
                              {item === "Call back"
                                ? "Ustaw termin kontaktu"
                                : item === "Spotkanie"
                                  ? "Wymaga terminu i adresu"
                                  : item === "Umowa"
                                    ? "Wymaga numeru umowy"
                                    : item === "Zwrot"
                                      ? "Wraca do bazy leadów"
                                      : item === "Rezygnacja"
                                        ? "Wymaga powodu"
                                        : "Zmień etap leada"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!isAdmin && lead.status !== "Spotkanie" && lead.status !== "Umowa" ? (
                      <p className="mt-2 text-xs font-semibold text-muted">
                        Status Umowa pojawi się dopiero po zapisaniu statusu Spotkanie.
                      </p>
                    ) : null}
                  </div>

                  {status === "Call back" ? (
                    <label>
                      <span className="label">Data i godzina callbacku</span>
                      <input
                        className="field"
                        type="datetime-local"
                        value={callbackAt}
                        onChange={(event) => setCallbackAt(event.target.value)}
                      />
                    </label>
                  ) : null}

                  {status === "Spotkanie" ? (
                    <>
                      <label>
                        <span className="label">Data i godzina spotkania</span>
                        <input
                          className="field"
                          type="datetime-local"
                          value={meetingAt}
                          onChange={(event) => setMeetingAt(event.target.value)}
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">Adres klienta</span>
                        <input
                          className="field"
                          value={meetingAddress}
                          onChange={(event) => setMeetingAddress(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}

                  {status === "Rezygnacja" ? (
                    <label className="sm:col-span-2">
                      <span className="label">Powód rezygnacji</span>
                      <textarea
                        className="field min-h-24"
                        value={resignationReason}
                        onChange={(event) => setResignationReason(event.target.value)}
                      />
                    </label>
                  ) : null}

                  {status === "Umowa" ? (
                    <label className="sm:col-span-2">
                      <span className="label">Numer umowy</span>
                      <input
                        className="field border-[#9bd7a1] bg-[#f3fbf4] font-bold text-[#23682e]"
                        value={contractNumber}
                        onChange={(event) => setContractNumber(event.target.value)}
                        placeholder="np. B/2026/001"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="btn-primary">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz
                  </button>
                  <button type="button" onClick={returnLead} disabled={busy} className="btn-secondary">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Zwrot
                  </button>
                </div>
              </form>

              <div className="grid gap-5">
                <form onSubmit={saveLeadData} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 className="text-base font-bold text-ink">Dane adresowe</h2>
                  </div>
                  <div className="grid gap-3">
                    <label>
                      <span className="label">Kod pocztowy</span>
                      <input
                        className="field"
                        value={postalCode}
                        onChange={(event) => setPostalCode(event.target.value)}
                        placeholder="np. 30-001"
                      />
                    </label>
                    <label>
                      <span className="label">Adres</span>
                      <input
                        className="field"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Ulica, numer, miejscowość"
                      />
                    </label>
                    <RegionFields
                      voivodeship={voivodeship}
                      county={county}
                      onVoivodeshipChange={setVoivodeship}
                      onCountyChange={setCounty}
                    />
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary mt-4">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz dane
                  </button>
                </form>

                {isAdmin ? (
                  <form onSubmit={assignLead} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                        <UserCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h2 className="text-base font-bold text-ink">Przypisanie</h2>
                    </div>
                    <label>
                      <span className="label">Handlowiec</span>
                      <select
                        className="field"
                        value={selectedAssignee}
                        onChange={(event) => setSelectedAssignee(event.target.value)}
                      >
                        <option value="">Nieprzypisany</option>
                        {salespeople.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={busy} className="btn-primary mt-4">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Zapisz przypisanie
                    </button>
                  </form>
                ) : null}

                <form onSubmit={addComment} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                      <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 className="text-base font-bold text-ink">Komentarz</h2>
                  </div>
                  <textarea
                    className="field min-h-28"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !comment.trim()} className="btn-primary mt-4">
                    Dodaj komentarz
                  </button>
                </form>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-ink">Historia leada</h2>
              <div className="mt-4 grid gap-3">
                {history.map((item) => (
                  <div key={item.id} className="rounded-md border border-line bg-[#f9fbfd] p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-semibold text-ink">
                        {ACTION_LABELS[item.action_type] || item.action_type}
                      </div>
                      <div className="text-xs text-muted">{formatDateTime(item.created_at)}</div>
                    </div>
                    <p className="mt-2 text-sm text-muted">{item.description}</p>
                    <div className="mt-2 text-xs text-muted">
                      {item.user_profile?.full_name || "System"}
                    </div>
                  </div>
                ))}
                {history.length === 0 ? (
                  <div className="rounded-md border border-line bg-[#f9fbfd] p-6 text-center text-sm font-semibold text-muted">
                    Brak historii.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

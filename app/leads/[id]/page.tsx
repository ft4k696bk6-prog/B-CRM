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
import { ActivityLog } from "@/components/activity-log";
import { FileList } from "@/components/file-list";
import { ReminderList } from "@/components/reminder-list";
import { Alert, EmptyState, SectionHeader } from "@/components/ui";
import { ACTION_LABELS, LEAD_STATUSES, STATUS_LABELS, STATUS_TILE_TONES } from "@/lib/constants";
import { hasAnyPermission } from "@/lib/permissions";
import { formatDateTime, toDatetimeLocalValue } from "@/lib/date";
import { formatPhoneReadable } from "@/lib/phone";
import { canManageLeads, homePathForRole, isManagerRole, isSalesRole } from "@/lib/roles";
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
    return [
      "Spotkanie",
      "Po spotkaniu",
      "Umowa",
      "Call back",
      "Rezygnacja",
      "Zwrot",
      "Nie odebrał"
    ];
  }

  if (lead.status === "Po spotkaniu") {
    return ["Po spotkaniu", "Umowa", "Call back", "Rezygnacja", "Zwrot", "Nie odebrał"];
  }

  return base.includes(lead.status) ? base : [lead.status, ...base];
}

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading, profile, session } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [salespeople, setSalespeople] = useState<Profile[]>([]);
  const [status, setStatus] = useState<LeadStatus>("Nowy");
  const [callbackAt, setCallbackAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingAddress, setMeetingAddress] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  const [soldScope, setSoldScope] = useState("");
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

  const canManage = canManageLeads(profile?.role);
  const canEditLead = hasAnyPermission(profile?.role, ["leads:edit:own", "leads:edit:team", "leads:edit:all"]);
  const isManager = isManagerRole(profile?.role);
  const backHref = homePathForRole(profile?.role);

  async function loadLead() {
    if (!params.id || !profile) return;

    setBusy(true);
    setError("");

    const { data, error: leadError } = await supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
      .eq("id", params.id)
      .eq("crm_environment", profile.crm_environment)
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
    setMeetingNote(nextLead.meeting_note || "");
    setSoldScope("");
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
      .eq("id", params.id)
      .eq("crm_environment", profile.crm_environment);

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
    if (!profile) return;

    const query = supabase
      .from("profiles")
      .select("*")
      .in("role", ["handlowiec", "sales", "menadzer"])
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true });

    const { data } = await query;
    const assignablePeople =
      isManager
        ? ((data || []) as Profile[]).filter((person) => person.id === profile.id || person.manager_id === profile.id)
        : ((data || []) as Profile[]);
    const peopleWithManager =
      isManager && !assignablePeople.some((person) => person.id === profile.id)
        ? [...assignablePeople, profile].sort((a, b) => a.full_name.localeCompare(b.full_name, "pl"))
        : assignablePeople;

    setSalespeople(peopleWithManager);
  }

  useEffect(() => {
    if (!profile) return;
    loadLead();
    loadHistory();
    if (canManageLeads(profile.role)) loadSalespeople();
  }, [profile, params.id]);

  async function refresh() {
    await Promise.all([loadLead(), loadHistory()]);
  }

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !profile) return;

    setBusy(true);
    setError("");

    const patch: Partial<Lead> = { status };
    const availableStatuses = canManage ? LEAD_STATUSES : getSalesStatusPath(lead);

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

    if (status === "Po spotkaniu") {
      if (!meetingNote.trim()) {
        setError("Wpisz notatkę po spotkaniu.");
        setBusy(false);
        return;
      }
      patch.meeting_note = [
        meetingNote.trim(),
        soldScope.trim() ? `Sprzedano / zakres oferty: ${soldScope.trim()}` : ""
      ].filter(Boolean).join("\n\n");
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
      if (
        !canManage &&
        lead.status !== "Spotkanie" &&
        lead.status !== "Po spotkaniu" &&
        lead.status !== "Umowa"
      ) {
        setError("Umowę można oznaczyć dopiero po spotkaniu.");
        setBusy(false);
        return;
      }

      if (!contractNumber.trim()) {
        setError("Wpisz numer umowy.");
        setBusy(false);
        return;
      }

      patch.contract_number = contractNumber.trim();
      if (soldScope.trim()) {
        patch.meeting_note = [
          meetingNote.trim(),
          `Sprzedano / zakres oferty: ${soldScope.trim()}`
        ].filter(Boolean).join("\n\n");
      }
      if (isSalesRole(profile.role)) {
        patch.assigned_to = profile.id;
      }
    }

    if (status === "Zwrot") {
      await returnLead();
      return;
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", lead.id)
      .eq("crm_environment", profile.crm_environment);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
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
    if (!lead || !profile) return;

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
      .eq("id", lead.id)
      .eq("crm_environment", profile.crm_environment);

    if (updateError) {
      setError(updateError.message);
    } else {
      await refresh();
    }

    setBusy(false);
  }

  async function returnLead() {
    if (!lead || !profile || !session?.access_token) return;

    setBusy(true);
    setError("");

    const response = await fetch("/api/leads/return", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ leadIds: [lead.id] })
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(result.error || "Nie udało się zwrócić leada.");
      setBusy(false);
      return;
    }

    if (isSalesRole(profile?.role)) {
      router.replace("/sales");
    } else {
      await refresh();
      setBusy(false);
    }
  }

  async function assignLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !profile || !session?.access_token || !canManage) return;

    setBusy(true);
    setError("");

    const response = await fetch("/api/leads/assign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        leadIds: [lead.id],
        assignedTo: selectedAssignee || null
      })
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(result.error || "Nie udało się zapisać przypisania.");
    } else {
      await refresh();
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;
  const availableStatuses = lead ? (canManage ? LEAD_STATUSES : canEditLead ? getSalesStatusPath(lead) : [lead.status]) : [];

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
          <Alert tone="danger">
            {error}
          </Alert>
        ) : null}

        {!lead ? (
          <LoadingScreen label={busy ? "Ładowanie leada" : "Brak danych"} />
        ) : (
          <>
            <section className="app-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-ink">{lead.full_name}</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                    <span>{formatPhoneReadable(lead.phone)}</span>
                    <span>·</span>
                    <span>{lead.postal_code || "brak kodu"}</span>
                    <span>·</span>
                    <span>{lead.source || "bez źródła"}</span>
                  </div>
                </div>
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
                  <dt className="label">Call-back</dt>
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
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3 sm:col-span-2 xl:col-span-3">
                  <dt className="label">Notatka po spotkaniu</dt>
                  <dd className="text-sm font-semibold text-ink">{lead.meeting_note || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={saveStatus} className="app-card">
                <SectionHeader icon={CalendarClock} title="Status i terminy" tone="sky" className="mb-4" />

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
                            onClick={() => canEditLead && setStatus(item)}
                            disabled={!canEditLead}
                            className={`min-h-20 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              STATUS_TILE_TONES[item]
                            } ${active ? "ring-2 ring-ink ring-offset-2" : ""}`}
                          >
                            <span className="block text-sm font-black">{STATUS_LABELS[item]}</span>
                            <span className="mt-1 block text-xs opacity-80">
                              {item === "Call back"
                                ? "Ustaw termin kontaktu"
                                : item === "Spotkanie"
                                  ? "Wymaga terminu i adresu"
                                  : item === "Po spotkaniu"
                                    ? "Wymaga notatki"
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
                    {!canManage &&
                    lead.status !== "Spotkanie" &&
                    lead.status !== "Po spotkaniu" &&
                    lead.status !== "Umowa" ? (
                      <p className="mt-2 text-xs font-semibold text-muted">
                        Status Umowa pojawi się dopiero po zapisaniu statusu Spotkanie.
                      </p>
                    ) : null}
                  </div>

                  {status === "Call back" ? (
                    <label>
                      <span className="label">Data i godzina call-backu</span>
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

                  {status === "Po spotkaniu" || status === "Umowa" ? (
                    <>
                      <label className="sm:col-span-2">
                        <span className="label">Notatka po spotkaniu</span>
                        <textarea
                          className="field min-h-28"
                          value={meetingNote}
                          onChange={(event) => setMeetingNote(event.target.value)}
                          placeholder="Co ustalono, jaki kolejny krok, uwagi klienta"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">Co sprzedano / zakres oferty</span>
                        <textarea
                          className="field min-h-24"
                          value={soldScope}
                          onChange={(event) => setSoldScope(event.target.value)}
                          placeholder="np. magazyn 10,24 kWh, falownik 8 kW, backup, bojler, cena brutto"
                        />
                      </label>
                      <div className="sm:col-span-2 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                        Umowę PDF i zdjęcia dodaj niżej w sekcji plików leada. Po zapisaniu statusu Umowa klient trafi do zakładki Umowy i proces.
                      </div>
                    </>
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
                  <button type="submit" disabled={busy || !canEditLead} className="btn-primary">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz
                  </button>
                  <button type="button" onClick={returnLead} disabled={busy || !canEditLead} className="btn-secondary">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Zwrot
                  </button>
                </div>
              </form>

              <div className="grid gap-5">
                <form onSubmit={saveLeadData} className="app-card">
                  <SectionHeader icon={MapPin} title="Dane adresowe" tone="sky" className="mb-4" />
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
                  <button type="submit" disabled={busy || !canEditLead} className="btn-primary mt-4">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz dane
                  </button>
                </form>

                {canManage ? (
                  <form onSubmit={assignLead} className="app-card">
                    <SectionHeader icon={UserCheck} title="Przypisanie" tone="leaf" className="mb-4" />
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

                {canEditLead ? (
                <form onSubmit={addComment} className="app-card">
                  <SectionHeader icon={MessageSquarePlus} title="Komentarz" tone="solar" className="mb-4" />
                  <textarea
                    className="field min-h-28"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !comment.trim()} className="btn-primary mt-4">
                    Dodaj komentarz
                  </button>
                </form>
                ) : (
                  <Alert tone="info">Tryb tylko do odczytu: komentarze i edycja są zablokowane dla tej roli.</Alert>
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="text-base font-bold text-ink">Aktywności</h2>
              <div className="mt-4">
                {session?.access_token && (
                  <ActivityLog
                    leadId={lead.id}
                    token={session.access_token}
                  />
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="text-base font-bold text-ink">Pliki</h2>
              <div className="mt-4">
                {session?.access_token && (
                  <FileList
                    leadId={lead.id}
                    token={session.access_token}
                  />
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="text-base font-bold text-ink">Przypomnienia</h2>
              <div className="mt-4">
                {session?.access_token && (
                  <ReminderList
                    leadId={lead.id}
                    token={session.access_token}
                  />
                )}
              </div>
            </section>

            <section className="app-card">
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
                  <EmptyState title="Brak historii" description="Aktywności pojawią się po pierwszej zmianie lub komentarzu." />
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  FileSignature,
  MapPin,
  MessageSquarePlus,
  RotateCcw,
  Save,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { RegionFields } from "@/components/region-fields";
import { StatusBadge } from "@/components/status-badge";
import { Alert, EmptyState, SectionHeader } from "@/components/ui";
import {
  ACTION_LABELS,
  LEAD_STATUSES,
  STATUS_LABELS,
  STATUS_TILE_TONES,
} from "@/lib/constants";
import { hasAnyPermission } from "@/lib/permissions";
import { formatDateTime, toDatetimeLocalValue } from "@/lib/date";
import { formatPhoneReadable } from "@/lib/phone";
import {
  canManageLeads,
  homePathForRole,
  isManagerRole,
  isSalesRole,
} from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadHistory, LeadStatus, Profile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function getSalesStatusPath(lead: Lead): LeadStatus[] {
  if (lead.status === "Umowa") return ["Umowa"];
  if (lead.status === "Rezygnacja") return ["Rezygnacja"];

  const base: LeadStatus[] = [
    "Nowy",
    "Nie odebrał",
    "Call back",
    "Spotkanie",
    "Rezygnacja",
  ];

  if (lead.status === "Spotkanie") {
    return [
      "Spotkanie",
      "Po spotkaniu",
      "Umowa",
      "Call back",
      "Rezygnacja",
      "Nie odebrał",
    ];
  }

  if (lead.status === "Po spotkaniu") {
    return ["Po spotkaniu", "Umowa", "Call back", "Rezygnacja", "Nie odebrał"];
  }

  return base.includes(lead.status) ? base : [lead.status, ...base];
}

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const embedded = searchParams.get("embedded") === "1";
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
  const [returnNote, setReturnNote] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loggedLeadId = useRef<string | null>(null);

  const canManage = canManageLeads(profile?.role);
  const canEditLead = hasAnyPermission(profile?.role, [
    "leads:edit:own",
    "leads:edit:team",
    "leads:edit:all",
  ]);
  const isManager = isManagerRole(profile?.role);
  const backHref = homePathForRole(profile?.role);

  async function loadLead() {
    if (!params.id || !profile) return;

    setBusy(true);
    setError("");

    const { data, error: leadError } = await supabase
      .from("leads")
      .select(
        "*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)",
      )
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

    if (loggedLeadId.current !== nextLead.id) {
      loggedLeadId.current = nextLead.id;
      await supabase.from("lead_history").insert({
        lead_id: nextLead.id,
        user_id: profile.id,
        action_type: "lead_opened",
        description: "Otwarto szczegóły leada.",
      });
    }

    setBusy(false);
  }

  async function loadHistory() {
    if (!params.id) return;

    const { data } = await supabase
      .from("lead_history")
      .select(
        "*, user_profile:profiles!lead_history_user_id_fkey(id,email,full_name,role)",
      )
      .eq("lead_id", params.id)
      .neq("action_type", "lead_opened")
      .order("created_at", { ascending: false })
      .limit(200);

    setHistory((data || []) as LeadHistory[]);
  }

  async function loadSalespeople() {
    if (!profile) return;

    const query = supabase
      .from("profiles")
      .select(
        "id,email,full_name,role,manager_id,crm_environment,created_at,business_phone,can_view_lead_pool",
      )
      .in("role", ["handlowiec", "sales", "menadzer"])
      .eq("crm_environment", profile.crm_environment)
      .order("full_name", { ascending: true });

    const { data } = await query;
    const assignablePeople = isManager
      ? ((data || []) as Profile[]).filter(
          (person) =>
            person.id === profile.id || person.manager_id === profile.id,
        )
      : ((data || []) as Profile[]);
    const peopleWithManager =
      isManager && !assignablePeople.some((person) => person.id === profile.id)
        ? [...assignablePeople, profile].sort((a, b) =>
            a.full_name.localeCompare(b.full_name, "pl"),
          )
        : assignablePeople;

    setSalespeople(peopleWithManager);
  }

  useEffect(() => {
    if (!profile) return;
    loadLead();
    loadHistory();
    if (canManageLeads(profile.role)) loadSalespeople();
  }, [profile?.id, profile?.crm_environment, params.id]);

  async function refresh() {
    await Promise.all([loadLead(), loadHistory()]);
    if (embedded && window.parent !== window)
      window.parent.postMessage(
        { type: "bcrm:lead-updated", leadId: params.id },
        window.location.origin,
      );
  }

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !profile) return;

    setBusy(true);
    setError("");

    const patch: Partial<Lead> = { status };
    const isClosedLead =
      lead.status === "Umowa" || lead.status === "Rezygnacja";
    const availableStatuses =
      isClosedLead && !canManage
        ? [lead.status]
        : canManage
          ? LEAD_STATUSES
          : getSalesStatusPath(lead);

    if (!availableStatuses.includes(status)) {
      setError("Ten status nie jest dostępny na obecnym etapie leada.");
      setBusy(false);
      return;
    }

    if (
      status === "Rezygnacja" ||
      (profile.role === "handlowiec" &&
        status !== "Po spotkaniu" &&
        (status !== lead.status ||
          status === "Call back" ||
          status === "Spotkanie"))
    ) {
      if (!session?.access_token) {
        setError("Sesja wygasła. Zaloguj się ponownie.");
        setBusy(false);
        return;
      }
      const outcome =
        status === "Call back"
          ? "callback"
          : status === "Spotkanie"
            ? "meeting"
            : status === "Nie odebrał"
              ? "no_answer"
              : status === "Rezygnacja"
                ? "resignation"
                : status === "Umowa"
                  ? "contract"
                  : null;
      if (!outcome) {
        setError("Ta zmiana nie jest dostępna na obecnym etapie leada.");
        setBusy(false);
        return;
      }
      const response = await fetch("/api/leads/outcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          leadId: lead.id,
          outcome,
          callbackAt,
          meetingAt,
          address: meetingAddress,
          note: outcome === "resignation" ? resignationReason : meetingNote,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
      };
      if (!response.ok) {
        setError(result.error || "Nie udało się zapisać wyniku.");
        setBusy(false);
        return;
      }
      await refresh();
      window.dispatchEvent(new Event("leads:changed"));
      setBusy(false);
      if (result.redirect) router.push(result.redirect);
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
        soldScope.trim()
          ? `Sprzedano / zakres oferty: ${soldScope.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
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

      router.push(`/realizacja/nowa?leadId=${lead.id}`);
      setBusy(false);
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
      description: comment.trim(),
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
        county: county || null,
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

    if (isSalesRole(profile.role) && !returnNote.trim()) {
      setError("Zwrot wymaga notatki.");
      setBusy(false);
      return;
    }
    const response = await fetch(
      isSalesRole(profile.role) ? "/api/leads/outcome" : "/api/leads/return",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          isSalesRole(profile.role)
            ? { leadId: lead.id, outcome: "return", note: returnNote.trim() }
            : { leadIds: [lead.id] },
        ),
      },
    );

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

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
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leadIds: [lead.id],
        assignedTo: selectedAssignee || null,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(result.error || "Nie udało się zapisać przypisania.");
    } else {
      await refresh();
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;
  const availableStatuses = lead
    ? (lead.status === "Umowa" || lead.status === "Rezygnacja") && !canManage
      ? [lead.status]
      : canManage
        ? LEAD_STATUSES
        : canEditLead
          ? getSalesStatusPath(lead)
          : [lead.status]
    : [];

  return (
    <AppShell profile={profile} embedded={embedded}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!embedded ? (
            <Link href={backHref} className="btn-secondary w-fit">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Wróć
            </Link>
          ) : (
            <span />
          )}
          {lead ? <StatusBadge status={lead.status} /> : null}
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {!lead ? (
          <LoadingScreen label={busy ? "Ładowanie leada" : "Brak danych"} />
        ) : (
          <>
            <section className="app-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-ink">
                    {lead.full_name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-muted">
                      {formatPhoneReadable(lead.phone)}
                    </span>
                    <span className="rounded-md border border-sky/20 bg-sky/10 px-2 py-1 font-bold text-sky">
                      Źródło: {lead.source || "bez źródła"}
                    </span>
                    {lead.campaign ? (
                      <span className="rounded-md border border-solar/25 bg-solar/10 px-2 py-1 font-bold text-[#8a5a00]">
                        Kampania: {lead.campaign}
                      </span>
                    ) : null}
                    <span className="rounded-md border border-line bg-[#f8fafc] px-2 py-1 font-semibold text-muted">
                      {lead.postal_code || "brak kodu"}
                    </span>
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
                      <div className="text-sm font-bold uppercase tracking-wide">
                        Umowa
                      </div>
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
                  <dd className="text-sm font-semibold text-ink">
                    {lead.address || "—"}
                  </dd>
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
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateTime(lead.created_at)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Modyfikacja</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateTime(lead.updated_at)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Call-back</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateTime(lead.callback_at)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Spotkanie</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateTime(lead.meeting_at)}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3">
                  <dt className="label">Numer umowy</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lead.contract_number || "—"}
                  </dd>
                </div>
                <div className="rounded-md border border-line bg-[#f9fbfd] p-3 sm:col-span-2 xl:col-span-3">
                  <dt className="label">Notatka po spotkaniu</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lead.meeting_note || "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={saveStatus} className="app-card">
                <SectionHeader
                  icon={CalendarClock}
                  title="Status i terminy"
                  tone="sky"
                  className="mb-4"
                />

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
                            <span className="block text-sm font-black">
                              {STATUS_LABELS[item]}
                            </span>
                            <span className="mt-1 block text-xs opacity-80">
                              {item === "Call back"
                                ? "Ustaw termin kontaktu"
                                : item === "Spotkanie"
                                  ? "Wymaga terminu i adresu"
                                  : item === "Po spotkaniu"
                                    ? "Wymaga notatki"
                                    : item === "Umowa"
                                      ? "Wymaga numeru umowy"
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
                        Status Umowa pojawi się dopiero po zapisaniu statusu
                        Spotkanie.
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
                          onChange={(event) =>
                            setMeetingAddress(event.target.value)
                          }
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
                        onChange={(event) =>
                          setResignationReason(event.target.value)
                        }
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
                          onChange={(event) =>
                            setMeetingNote(event.target.value)
                          }
                          placeholder="Co ustalono, jaki kolejny krok, uwagi klienta"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="label">
                          Co sprzedano / zakres oferty
                        </span>
                        <textarea
                          className="field min-h-24"
                          value={soldScope}
                          onChange={(event) => setSoldScope(event.target.value)}
                          placeholder="np. magazyn 10,24 kWh, falownik 8 kW, backup, bojler, cena brutto"
                        />
                      </label>
                      <div className="sm:col-span-2 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                        Po wybraniu „Umowa” otworzy się wersja robocza. Lead
                        trafi do realizacji dopiero po dodaniu PDF-u, zdjęcia i
                        użyciu „Wyślij komplet”.
                      </div>
                    </>
                  ) : null}

                  {status === "Umowa" ? (
                    <label className="sm:col-span-2">
                      <span className="label">Numer umowy</span>
                      <input
                        className="field border-[#9bd7a1] bg-[#f3fbf4] font-bold text-[#23682e]"
                        value={contractNumber}
                        onChange={(event) =>
                          setContractNumber(event.target.value)
                        }
                        placeholder="np. B/2026/001"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy || !canEditLead}
                    className="btn-primary"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz
                  </button>
                  {isSalesRole(profile.role) ? (
                    <label className="basis-full">
                      <span className="label">
                        Notatka wymagana przy zwrocie
                      </span>
                      <textarea
                        className="field min-h-20"
                        value={returnNote}
                        onChange={(event) => setReturnNote(event.target.value)}
                        placeholder="Dlaczego lead wraca do puli?"
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={returnLead}
                    disabled={
                      busy ||
                      !canEditLead ||
                      (!canManage &&
                        (lead.status === "Umowa" ||
                          lead.status === "Rezygnacja"))
                    }
                    className="btn-secondary"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Zwrot
                  </button>
                </div>
              </form>

              <div className="grid gap-5">
                <form onSubmit={saveLeadData} className="app-card">
                  <SectionHeader
                    icon={MapPin}
                    title="Dane adresowe"
                    tone="sky"
                    className="mb-4"
                  />
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
                  <button
                    type="submit"
                    disabled={busy || !canEditLead}
                    className="btn-primary mt-4"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Zapisz dane
                  </button>
                </form>

                {canManage ? (
                  <form onSubmit={assignLead} className="app-card">
                    <SectionHeader
                      icon={UserCheck}
                      title="Przypisanie"
                      tone="leaf"
                      className="mb-4"
                    />
                    <label>
                      <span className="label">Handlowiec</span>
                      <select
                        className="field"
                        value={selectedAssignee}
                        onChange={(event) =>
                          setSelectedAssignee(event.target.value)
                        }
                      >
                        <option value="">Nieprzypisany</option>
                        {salespeople.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-primary mt-4"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Zapisz przypisanie
                    </button>
                  </form>
                ) : null}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              <div className="app-card">
                <h2 className="text-base font-bold text-ink">Historia leada</h2>
                <div className="mt-4 grid max-h-[680px] gap-3 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-line bg-[#f9fbfd] p-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold text-ink">
                          {ACTION_LABELS[item.action_type] || item.action_type}
                        </div>
                        <div className="text-xs text-muted">
                          {formatDateTime(item.created_at)}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        {item.description}
                      </p>
                      <div className="mt-2 text-xs text-muted">
                        {item.user_profile?.full_name || "System"}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 ? (
                    <EmptyState
                      title="Brak historii"
                      description="Historia pojawi się po pierwszej zmianie lub komentarzu."
                    />
                  ) : null}
                </div>
              </div>

              {canEditLead ? (
                <form
                  onSubmit={addComment}
                  className="app-card h-fit xl:sticky xl:top-20"
                >
                  <SectionHeader
                    icon={MessageSquarePlus}
                    title="Komentarze"
                    tone="solar"
                    className="mb-4"
                  />
                  <textarea
                    className="field min-h-40"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Dodaj ustalenia z rozmowy lub ważną informację…"
                  />
                  <button
                    type="submit"
                    disabled={busy || !comment.trim()}
                    className="btn-primary mt-4 w-full"
                  >
                    Dodaj komentarz
                  </button>
                </form>
              ) : (
                <Alert tone="info">
                  Komentarze są dostępne tylko dla osób z prawem edycji leada.
                </Alert>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

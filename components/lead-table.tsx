"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Columns3, ExternalLink, Phone, Table2, Zap, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/date";
import { formatPhoneReadable, normalizePhoneForDial } from "@/lib/phone";
import type { Lead, LeadStatus } from "@/lib/types";

type LeadTableProps = {
  leads: Lead[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  showAssignee?: boolean;
  onQuickAction?: (lead: Lead) => void;
};

type LeadView = "table" | "funnel";

const LEAD_VIEW_STORAGE_KEY = "bcrm:lead-view";

const statusTone: Record<LeadStatus, string> = {
  Nowy: "bg-sky",
  "Call back": "bg-amber-500",
  Spotkanie: "bg-violet-500",
  "Po spotkaniu": "bg-cyan-500",
  Umowa: "bg-leaf",
  Rezygnacja: "bg-danger",
  "Nie odebrał": "bg-slate-500"
};

function formatPhone(phone: string) {
  return formatPhoneReadable(phone) || phone;
}

function phoneHref(phone: string) {
  const normalized = normalizePhoneForDial(phone);
  return `tel:${normalized || phone.replace(/\s/g, "")}`;
}

function formatSource(source: string | null, language: "pl" | "en") {
  if (!source) return language === "en" ? "No source" : "Bez źródła";

  const normalized = source.toLowerCase();
  if (normalized === "własne" || normalized === "wlasne") {
    return language === "en" ? "Own" : "Własne";
  }
  if (normalized === "polecenie") {
    return language === "en" ? "Referral" : "Polecenie";
  }

  return source;
}

export function LeadTable({
  leads,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  showAssignee = false,
  onQuickAction
}: LeadTableProps) {
  const { language } = useLanguage();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [view, setView] = useState<LeadView>("table");

  useEffect(() => {
    const savedView = window.localStorage.getItem(LEAD_VIEW_STORAGE_KEY);
    if (savedView === "table" || savedView === "funnel") setView(savedView);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin === window.location.origin && event.data?.type === "bcrm:lead-updated") {
        window.dispatchEvent(new Event("leads:changed"));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const allSelected = leads.length > 0 && leads.every((lead) => selectedIds.includes(lead.id));
  const groupedLeads = useMemo(
    () => Object.fromEntries(LEAD_STATUSES.map((status) => [status, leads.filter((lead) => lead.status === status)])) as Record<LeadStatus, Lead[]>,
    [leads]
  );

  const labels = language === "en"
    ? {
        selectAll: "Select all",
        selectAllLeads: "Select all leads",
        selectLead: "Select",
        lead: "Lead",
        phone: "Phone",
        region: "Region",
        status: "Status",
        salesperson: "Salesperson",
        dates: "Dates",
        created: "Created",
        noCode: "no code",
        unassigned: "Unassigned",
        openLeadCard: "Open lead card",
        openCard: "Open card",
        quickAction: "Quick action",
        close: "Close",
        leadCard: "Lead card",
        tableView: "Table",
        funnelView: "Funnel",
        viewLabel: "Lead view",
        noLeads: "No leads",
        noLeadsDescription: "No leads match the selected filters.",
        emptyStage: "No leads at this stage"
      }
    : {
        selectAll: "Zaznacz wszystkie",
        selectAllLeads: "Zaznacz wszystkie leady",
        selectLead: "Zaznacz",
        lead: "Lead",
        phone: "Telefon",
        region: "Region",
        status: "Status",
        salesperson: "Handlowiec",
        dates: "Terminy",
        created: "Dodany",
        noCode: "brak kodu",
        unassigned: "Nieprzypisany",
        openLeadCard: "Otwórz kartę leada",
        openCard: "Otwórz kartę",
        quickAction: "Szybka akcja",
        close: "Zamknij",
        leadCard: "Karta leada",
        tableView: "Tabela",
        funnelView: "Lejek",
        viewLabel: "Widok leadów",
        noLeads: "Brak leadów",
        noLeadsDescription: "Brak leadów spełniających wybrane filtry.",
        emptyStage: "Brak leadów na tym etapie"
      };

  function changeView(nextView: LeadView) {
    setView(nextView);
    window.localStorage.setItem(LEAD_VIEW_STORAGE_KEY, nextView);
  }

  function closeLeadCard() {
    setOpenLeadId(null);
    window.dispatchEvent(new Event("leads:changed"));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selectable && leads.length > 0 && view === "funnel" ? (
          <label className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-bold text-ink shadow-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4 rounded border-line text-ink focus:ring-ink"
            />
            {labels.selectAll}
            <span className="text-xs font-bold text-muted">{selectedIds.length}/{leads.length}</span>
          </label>
        ) : <span />}

        <div
          className="inline-flex items-center rounded-full border border-line bg-[#eef1f4] p-1 shadow-inner"
          role="group"
          aria-label={labels.viewLabel}
        >
          <button
            type="button"
            onClick={() => changeView("table")}
            aria-pressed={view === "table"}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-bold transition ${
              view === "table" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
            {labels.tableView}
          </button>
          <button
            type="button"
            onClick={() => changeView("funnel")}
            aria-pressed={view === "funnel"}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-bold transition ${
              view === "funnel" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />
            {labels.funnelView}
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          {selectable && leads.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-[#f8fafc] px-4 py-3 md:hidden">
              <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-line text-ink focus:ring-ink"
                />
                {labels.selectAll}
              </label>
              <span className="text-xs font-bold text-muted">{selectedIds.length}/{leads.length}</span>
            </div>
          ) : null}

          <div className="hidden md:block">
            <table className="app-table w-full table-fixed">
              <thead>
                <tr>
                  {selectable ? (
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={onToggleAll}
                        className="h-4 w-4 rounded border-line text-ink focus:ring-ink"
                        aria-label={labels.selectAllLeads}
                      />
                    </th>
                  ) : null}
                  <th className="w-[20%] px-2 py-3">{labels.lead}</th>
                  <th className="w-[14%] px-2 py-3">{labels.phone}</th>
                  <th className="w-[13%] px-2 py-3">{labels.region}</th>
                  <th className="w-[12%] px-2 py-3">{labels.status}</th>
                  {showAssignee ? <th className="w-[14%] px-2 py-3">{labels.salesperson}</th> : null}
                  <th className="w-[15%] px-2 py-3">{labels.dates}</th>
                  <th className="w-[12%] px-2 py-3">{labels.created}</th>
                  <th className={onQuickAction ? "w-24 px-3 py-3" : "w-12 px-3 py-3"} />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    {selectable ? (
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={() => onToggle?.(lead.id)}
                          className="h-4 w-4 rounded border-line text-ink focus:ring-ink"
                          aria-label={`${labels.selectLead} ${lead.full_name}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 align-top break-words">
                      {onQuickAction ? (
                        <button
                          type="button"
                          onClick={() => onQuickAction(lead)}
                          className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted transition hover:border-ink hover:text-ink"
                          title={labels.quickAction}
                          aria-label={`${labels.quickAction}: ${lead.full_name}`}
                        >
                          <Zap className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenLeadId(lead.id)}
                        className="font-semibold text-ink hover:text-sky"
                      >
                        {lead.full_name}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
                        <span className="rounded border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-sky">{formatSource(lead.source, language)}</span>
                        {lead.campaign ? <span className="max-w-56 truncate rounded border border-solar/25 bg-solar/10 px-1.5 py-0.5 text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</span> : null}
                        <span className="px-1 py-0.5 font-semibold text-muted">{lead.postal_code || labels.noCode}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <a
                        href={phoneHref(lead.phone)}
                        className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink hover:text-sky"
                      >
                        <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                        {formatPhone(lead.phone)}
                      </a>
                    </td>
                    <td className="px-3 py-3 align-top text-muted break-words">
                      <div>{lead.voivodeship || "—"}</div>
                      <div className="text-xs">{lead.county || "—"}</div>
                    </td>
                    <td className="px-3 py-3 align-top break-words">
                      <StatusBadge status={lead.status} />
                    </td>
                    {showAssignee ? (
                      <td className="px-3 py-3 align-top text-muted break-words">
                        {lead.assigned_profile?.full_name || labels.unassigned}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 align-top text-muted break-words">
                      {lead.callback_at ? (
                        <div className="mb-1 flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" aria-hidden="true" />
                          {formatDateTime(lead.callback_at)}
                        </div>
                      ) : null}
                      {lead.meeting_at ? <div>{formatDateTime(lead.meeting_at)}</div> : null}
                      {!lead.callback_at && !lead.meeting_at ? "—" : null}
                    </td>
                    <td className="px-3 py-3 align-top text-muted break-words">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="px-3 py-3 align-top break-words">
                      <button
                        type="button"
                        onClick={() => setOpenLeadId(lead.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted transition hover:border-ink hover:text-ink"
                        title={labels.openLeadCard}
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 md:hidden">
            {leads.map((lead) => (
              <article key={lead.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => setOpenLeadId(lead.id)} className="text-base font-black text-ink hover:text-sky">
                      {lead.full_name}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                      <span className="rounded border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-sky">{formatSource(lead.source, language)}</span>
                      {lead.campaign ? <span className="max-w-full truncate rounded border border-solar/25 bg-solar/10 px-1.5 py-0.5 text-[#8a5a00]">{lead.campaign}</span> : null}
                      <span className="px-1 py-0.5 font-semibold text-muted">{lead.postal_code || labels.noCode}</span>
                    </div>
                  </div>
                  {selectable ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => onToggle?.(lead.id)}
                      className="mt-1 h-5 w-5 flex-none rounded border-line text-ink focus:ring-ink"
                      aria-label={`${labels.selectLead} ${lead.full_name}`}
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={lead.status} />
                  {showAssignee ? (
                    <span className="rounded-md border border-line bg-[#f8fafc] px-2 py-1 text-xs font-bold text-muted">
                      {lead.assigned_profile?.full_name || labels.unassigned}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 text-sm">
                  <a
                    href={phoneHref(lead.phone)}
                    className="inline-flex min-h-11 w-fit min-w-[154px] items-center gap-2 whitespace-nowrap font-bold text-ink"
                  >
                    <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                    {formatPhone(lead.phone)}
                  </a>
                  <div className="grid gap-1 rounded-lg border border-line bg-[#f8fafc] p-3 text-xs font-semibold text-muted">
                    <div>{labels.region}: {lead.voivodeship || "—"} / {lead.county || "—"}</div>
                    <div>{labels.dates}: {lead.callback_at || lead.meeting_at ? [lead.callback_at, lead.meeting_at].filter(Boolean).map((value) => formatDateTime(value as string)).join(" · ") : "—"}</div>
                    <div>{labels.created}: {formatDateTime(lead.created_at)}</div>
                  </div>
                </div>

                {onQuickAction ? (
                  <button type="button" onClick={() => onQuickAction(lead)} className="btn-primary mt-4 min-h-11 w-full">
                    <Zap className="h-4 w-4" aria-hidden="true" />{labels.quickAction}
                  </button>
                ) : null}
                <button type="button" onClick={() => setOpenLeadId(lead.id)} className="btn-secondary mt-2 w-full">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {labels.openCard}
                </button>
              </article>
            ))}
          </div>

          {leads.length === 0 ? (
            <EmptyState title={labels.noLeads} description={labels.noLeadsDescription} className="m-3" />
          ) : null}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border border-line bg-white shadow-sm">
          <EmptyState title={labels.noLeads} description={labels.noLeadsDescription} className="m-3" />
        </div>
      ) : (
        <section className="overflow-x-auto pb-3" aria-label={labels.funnelView}>
          <div className="flex min-w-max items-start gap-3">
            {LEAD_STATUSES.map((status) => {
              const statusLeads = groupedLeads[status];
              return (
                <div key={status} className="w-[292px] flex-none rounded-2xl border border-line bg-[#f5f7f9] p-2.5">
                  <header className="mb-2.5 flex items-center justify-between gap-2 px-1 py-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 flex-none rounded-full ${statusTone[status]}`} aria-hidden="true" />
                      <h3 className="truncate text-sm font-black text-ink">{status}</h3>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black tabular-nums text-muted shadow-sm">
                      {statusLeads.length}
                    </span>
                  </header>

                  <div className="grid min-h-24 gap-2.5">
                    {statusLeads.map((lead) => (
                      <article key={lead.id} className="group rounded-xl border border-line bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky/40 hover:shadow-md">
                        <div className="flex items-start gap-2">
                          {selectable ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(lead.id)}
                              onChange={() => onToggle?.(lead.id)}
                              className="mt-1 h-4 w-4 flex-none rounded border-line text-ink focus:ring-ink"
                              aria-label={`${labels.selectLead} ${lead.full_name}`}
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setOpenLeadId(lead.id)}
                              className="block max-w-full truncate text-left font-black text-ink transition hover:text-sky"
                              title={lead.full_name}
                            >
                              {lead.full_name}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                              <span className="rounded border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-sky">{formatSource(lead.source, language)}</span>
                              {lead.campaign ? <span className="max-w-36 truncate rounded border border-solar/25 bg-solar/10 px-1.5 py-0.5 text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</span> : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpenLeadId(lead.id)}
                            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted transition hover:bg-sky/10 hover:text-sky"
                            title={labels.openLeadCard}
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 border-t border-line/70 pt-3 text-xs text-muted">
                          <a href={phoneHref(lead.phone)} className="inline-flex min-h-8 items-center gap-2 font-bold text-ink hover:text-sky">
                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatPhone(lead.phone)}
                          </a>
                          <div className="truncate" title={[lead.voivodeship, lead.county].filter(Boolean).join(" / ")}>
                            {[lead.voivodeship, lead.county].filter(Boolean).join(" / ") || lead.postal_code || "—"}
                          </div>
                          {showAssignee ? (
                            <div className="truncate font-semibold" title={lead.assigned_profile?.full_name || labels.unassigned}>
                              {lead.assigned_profile?.full_name || labels.unassigned}
                            </div>
                          ) : null}
                          {lead.callback_at || lead.meeting_at ? (
                            <div className="flex items-start gap-1.5 text-[11px]">
                              <CalendarClock className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                              <span>{[lead.callback_at, lead.meeting_at].filter(Boolean).map((value) => formatDateTime(value as string)).join(" · ")}</span>
                            </div>
                          ) : null}
                        </div>

                        {onQuickAction ? (
                          <button
                            type="button"
                            onClick={() => onQuickAction(lead)}
                            className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-sky/20 bg-sky/5 px-3 text-xs font-black text-sky transition hover:bg-sky/10"
                          >
                            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                            {labels.quickAction}
                          </button>
                        ) : null}
                      </article>
                    ))}
                    {statusLeads.length === 0 ? (
                      <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-line bg-white/60 px-4 text-center text-xs text-muted">
                        {labels.emptyStage}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {openLeadId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm" onClick={closeLeadCard}>
          <div className="relative h-[96vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn-icon absolute right-3 top-3 z-20 bg-white shadow" onClick={closeLeadCard} aria-label={labels.close}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <iframe title={labels.leadCard} src={`/leads/${openLeadId}?embedded=1`} className="h-full w-full border-0" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

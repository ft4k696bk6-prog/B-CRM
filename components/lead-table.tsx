"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Columns3, ExternalLink, List, Phone, Zap, X } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { groupLeadsByStatus } from "@/lib/lead-pipeline";
import { formatPhoneReadable, normalizePhoneForDial } from "@/lib/phone";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";

type LeadTableProps = {
  leads: Lead[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  showAssignee?: boolean;
  onQuickAction?: (lead: Lead) => void;
};

type LeadViewMode = "table" | "pipeline";

const LEAD_VIEW_STORAGE_KEY = "bcrm:lead-view";

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

function dialHref(phone: string) {
  const normalized = normalizePhoneForDial(phone);
  return normalized ? `tel:${normalized}` : undefined;
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
  const [viewMode, setViewMode] = useState<LeadViewMode>("table");

  useEffect(() => {
    const stored = window.localStorage.getItem(LEAD_VIEW_STORAGE_KEY);
    if (stored === "table" || stored === "pipeline") setViewMode(stored);
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
  const pipelineGroups = useMemo(() => groupLeadsByStatus(leads), [leads]);
  const labels = language === "en"
    ? {
        view: "Lead view",
        tableView: "Table",
        pipelineView: "Pipeline",
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
        noLeads: "No leads",
        noLeadsDescription: "No records for the selected filters.",
        emptyStage: "No leads at this stage"
      }
    : {
        view: "Widok leadów",
        tableView: "Tabela",
        pipelineView: "Lejek",
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
        noLeads: "Brak leadów",
        noLeadsDescription: "Brak rekordów dla wybranych filtrów.",
        emptyStage: "Brak leadów na tym etapie"
      };

  function changeView(next: LeadViewMode) {
    setViewMode(next);
    window.localStorage.setItem(LEAD_VIEW_STORAGE_KEY, next);
  }

  function closeLeadCard() {
    setOpenLeadId(null);
    window.dispatchEvent(new Event("leads:changed"));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-line bg-[#f8fafc] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">{labels.view}</div>
        <div className="inline-flex w-fit items-center rounded-lg border border-line bg-[#eef1f4] p-1 shadow-inner" role="group" aria-label={labels.view}>
          <button
            type="button"
            onClick={() => changeView("table")}
            aria-pressed={viewMode === "table"}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${viewMode === "table" ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}
          >
            <List className="h-4 w-4" aria-hidden="true" />
            {labels.tableView}
          </button>
          <button
            type="button"
            onClick={() => changeView("pipeline")}
            aria-pressed={viewMode === "pipeline"}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${viewMode === "pipeline" ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />
            {labels.pipelineView}
          </button>
        </div>
      </div>

      {selectable && leads.length > 0 && (viewMode === "pipeline" || viewMode === "table") ? (
        <div className={`${viewMode === "table" ? "md:hidden" : ""} flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5`}>
          <label className="flex min-h-10 items-center gap-3 text-sm font-bold text-ink">
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

      {viewMode === "table" ? (
        <>
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
                    <td className="break-words px-3 py-3 align-top">
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
                        href={dialHref(lead.phone)}
                        className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink hover:text-sky"
                      >
                        <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                        {formatPhoneReadable(lead.phone)}
                      </a>
                    </td>
                    <td className="break-words px-3 py-3 align-top text-muted">
                      <div>{lead.voivodeship || "—"}</div>
                      <div className="text-xs">{lead.county || "—"}</div>
                    </td>
                    <td className="break-words px-3 py-3 align-top">
                      <StatusBadge status={lead.status} />
                    </td>
                    {showAssignee ? (
                      <td className="break-words px-3 py-3 align-top text-muted">
                        {lead.assigned_profile?.full_name || labels.unassigned}
                      </td>
                    ) : null}
                    <td className="break-words px-3 py-3 align-top text-muted">
                      {lead.callback_at ? (
                        <div className="mb-1 flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" aria-hidden="true" />
                          {formatDateTime(lead.callback_at)}
                        </div>
                      ) : null}
                      {lead.meeting_at ? <div>{formatDateTime(lead.meeting_at)}</div> : null}
                      {!lead.callback_at && !lead.meeting_at ? "—" : null}
                    </td>
                    <td className="break-words px-3 py-3 align-top text-muted">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="break-words px-3 py-3 align-top">
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
                    href={dialHref(lead.phone)}
                    className="inline-flex min-h-11 w-fit min-w-[154px] items-center gap-2 whitespace-nowrap font-bold text-ink"
                  >
                    <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                    {formatPhoneReadable(lead.phone)}
                  </a>
                  <div className="grid gap-1 rounded-lg border border-line bg-[#f8fafc] p-3 text-xs font-semibold text-muted">
                    <div>{labels.region}: {lead.voivodeship || "—"} / {lead.county || "—"}</div>
                    <div>{labels.dates}: {lead.callback_at || lead.meeting_at ? [lead.callback_at, lead.meeting_at].filter(Boolean).map((value) => formatDateTime(value as string)).join(" · ") : "—"}</div>
                    <div>{labels.created}: {formatDateTime(lead.created_at)}</div>
                  </div>
                </div>

                {onQuickAction ? <button type="button" onClick={() => onQuickAction(lead)} className="btn-primary mt-4 min-h-11 w-full"><Zap className="h-4 w-4" aria-hidden="true" />{labels.quickAction}</button> : null}
                <button type="button" onClick={() => setOpenLeadId(lead.id)} className="btn-secondary mt-2 w-full">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {labels.openCard}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="overflow-x-auto bg-[#f8fafc] p-3 pb-4" aria-label={labels.pipelineView}>
          <div className="flex min-w-max items-start gap-3">
            {pipelineGroups.map(({ status, leads: stageLeads }) => (
              <section key={status} className="w-[292px] flex-none rounded-xl border border-line bg-[#f1f4f6] p-2.5">
                <header className="mb-2.5 flex items-center justify-between gap-2 px-1 py-1">
                  <StatusBadge status={status} />
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black tabular-nums text-muted shadow-sm">{stageLeads.length}</span>
                </header>
                <div className="grid min-h-24 gap-2.5">
                  {stageLeads.map((lead) => (
                    <article key={lead.id} className="rounded-xl border border-line bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky/40 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setOpenLeadId(lead.id)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-black text-ink hover:text-sky">{lead.full_name}</span>
                          <span className="mt-1 block truncate text-xs font-semibold text-muted">{lead.postal_code || labels.noCode} · {formatSource(lead.source, language)}</span>
                        </button>
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => onToggle?.(lead.id)}
                            className="mt-0.5 h-4 w-4 flex-none rounded border-line text-ink focus:ring-ink"
                            aria-label={`${labels.selectLead} ${lead.full_name}`}
                          />
                        ) : null}
                      </div>

                      {lead.campaign ? <div className="mt-2 truncate rounded border border-solar/25 bg-solar/10 px-2 py-1 text-xs font-bold text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</div> : null}

                      <div className="mt-3 grid gap-2 border-t border-line/70 pt-3 text-xs font-semibold text-muted">
                        <a href={dialHref(lead.phone)} className="inline-flex items-center gap-2 font-bold text-ink hover:text-sky">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatPhoneReadable(lead.phone)}
                        </a>
                        {showAssignee ? <div className="truncate">{labels.salesperson}: {lead.assigned_profile?.full_name || labels.unassigned}</div> : null}
                        <div className="truncate">{labels.region}: {lead.voivodeship || "—"}{lead.county ? ` / ${lead.county}` : ""}</div>
                        {lead.callback_at ? <div className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatDateTime(lead.callback_at)}</div> : null}
                        {lead.meeting_at ? <div>{labels.dates}: {formatDateTime(lead.meeting_at)}</div> : null}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {onQuickAction ? (
                          <button type="button" onClick={() => onQuickAction(lead)} className="btn-secondary min-h-9 flex-1 px-2 text-xs">
                            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                            {labels.quickAction}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setOpenLeadId(lead.id)}
                          className={`${onQuickAction ? "btn-icon" : "btn-secondary w-full"} min-h-9`}
                          title={labels.openLeadCard}
                          aria-label={`${labels.openLeadCard}: ${lead.full_name}`}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          {!onQuickAction ? labels.openCard : null}
                        </button>
                      </div>
                    </article>
                  ))}
                  {stageLeads.length === 0 ? <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-line bg-white/70 px-4 text-center text-xs font-semibold text-muted">{labels.emptyStage}</div> : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState title={labels.noLeads} description={labels.noLeadsDescription} className="m-3" />
      ) : null}
      {openLeadId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm" onClick={closeLeadCard}>
          <div className="relative h-[96vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn-icon absolute right-3 top-3 z-20 bg-white shadow" onClick={closeLeadCard} aria-label={language === "en" ? "Close" : "Zamknij"}><X className="h-5 w-5" /></button>
            <iframe title={language === "en" ? "Lead card" : "Karta leada"} src={`/leads/${openLeadId}?embedded=1`} className="h-full w-full border-0" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

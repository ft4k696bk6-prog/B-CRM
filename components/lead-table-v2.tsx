"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Columns3, List, Phone, Zap, X } from "lucide-react";
import { LeadCommentsDialog } from "@/components/lead-comments-dialog";
import { LeadFastActions } from "@/components/lead-fast-actions";
import { LeadInlineActions } from "@/components/lead-inline-actions";
import { LeadQuickActionDialog } from "@/components/lead-quick-action-dialog";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { formatDateTime } from "@/lib/date";
import { type LeadOutcome } from "@/lib/lead-outcomes";
import { groupLeadsByStatus } from "@/lib/lead-pipeline";
import { formatPhoneReadable, normalizePhoneForDial } from "@/lib/phone";
import type { Lead } from "@/lib/types";

type LeadTableProps = {
  leads: Lead[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  showAssignee?: boolean;
  onQuickAction?: (lead: Lead) => void;
  accessToken?: string;
  onChanged?: () => void | Promise<void>;
};

type LeadViewMode = "table" | "pipeline";
type PresetAction = { lead: Lead; outcome: LeadOutcome } | null;

const LEAD_VIEW_STORAGE_KEY = "bcrm:lead-view";

function formatSource(source: string | null, language: "pl" | "en") {
  if (!source) return language === "en" ? "No source" : "Bez źródła";
  const normalized = source.toLowerCase();
  if (normalized === "własne" || normalized === "wlasne") return language === "en" ? "Own" : "Własne";
  if (normalized === "polecenie") return language === "en" ? "Referral" : "Polecenie";
  return source;
}

function dialHref(phone: string) {
  const normalized = normalizePhoneForDial(phone);
  return normalized ? `tel:${normalized}` : undefined;
}

function MetaLine({ lead, showAssignee, labels }: {
  lead: Lead;
  showAssignee: boolean;
  labels: { region: string; salesperson: string; unassigned: string };
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-muted">
      <span className="truncate">{labels.region}: {lead.voivodeship || "—"}{lead.county ? ` / ${lead.county}` : ""}</span>
      {showAssignee ? <span className="truncate">{labels.salesperson}: {lead.assigned_profile?.full_name || labels.unassigned}</span> : null}
      {lead.callback_at ? <span className="inline-flex items-center gap-1 font-bold text-sky"><CalendarClock className="h-3.5 w-3.5" />{formatDateTime(lead.callback_at)}</span> : null}
      {lead.meeting_at ? <span className="font-bold text-leaf">Spotkanie: {formatDateTime(lead.meeting_at)}</span> : null}
    </div>
  );
}

export function LeadTable({
  leads,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  showAssignee = false,
  onQuickAction,
  accessToken = "",
  onChanged
}: LeadTableProps) {
  const { language } = useLanguage();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<LeadViewMode>("table");
  const [presetAction, setPresetAction] = useState<PresetAction>(null);
  const [commentsLead, setCommentsLead] = useState<Lead | null>(null);

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
        view: "Lead view", tableView: "List", pipelineView: "Pipeline", selectAll: "Select all",
        selectAllLeads: "Select all leads", selectLead: "Select", phone: "Phone", region: "Region",
        salesperson: "Salesperson", unassigned: "Unassigned", openLeadCard: "Open lead card", openCard: "Details",
        quickAction: "Quick action", noLeads: "No leads", noLeadsDescription: "No records for the selected filters.", emptyStage: "No leads at this stage",
        expandActions: "Expand actions and note", collapseActions: "Collapse actions"
      }
    : {
        view: "Widok leadów", tableView: "Lista", pipelineView: "Lejek", selectAll: "Zaznacz wszystkie",
        selectAllLeads: "Zaznacz wszystkie leady", selectLead: "Zaznacz", phone: "Telefon", region: "Region",
        salesperson: "Handlowiec", unassigned: "Nieprzypisany", openLeadCard: "Otwórz kartę leada", openCard: "Szczegóły",
        quickAction: "Szybka akcja", noLeads: "Brak leadów", noLeadsDescription: "Brak rekordów dla wybranych filtrów.", emptyStage: "Brak leadów na tym etapie",
        expandActions: "Rozwiń szybkie akcje i notatkę", collapseActions: "Zwiń szybkie akcje"
      };

  function changeView(next: LeadViewMode) {
    setViewMode(next);
    window.localStorage.setItem(LEAD_VIEW_STORAGE_KEY, next);
  }

  async function changed() {
    window.dispatchEvent(new Event("leads:changed"));
    await onChanged?.();
  }

  function closeLeadCard() {
    setOpenLeadId(null);
    void changed();
  }

  function openPreset(lead: Lead, outcome: LeadOutcome) {
    if (accessToken) setPresetAction({ lead, outcome });
    else onQuickAction?.(lead);
  }

  function fastActions(lead: Lead, variant: "card" | "compact" = "card") {
    if (accessToken) {
      return (
        <LeadFastActions
          lead={lead}
          accessToken={accessToken}
          variant={variant}
          onPreset={openPreset}
          onComments={setCommentsLead}
          onChanged={changed}
        />
      );
    }
    if (!onQuickAction) return null;
    return (
      <button type="button" onClick={() => onQuickAction(lead)} className="btn-secondary min-h-10 w-full text-xs">
        <Zap className="h-4 w-4" aria-hidden="true" />{labels.quickAction}
      </button>
    );
  }

  function toggleExpanded(leadId: string) {
    setExpandedLeadId((current) => current === leadId ? null : leadId);
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-[#f8fafc] px-2.5 py-2.5 sm:px-3">
        <div className="hidden text-xs font-bold uppercase tracking-wide text-muted sm:block">{labels.view}</div>
        <div className="inline-flex items-center rounded-xl border border-line bg-[#eef1f4] p-1 shadow-inner" role="group" aria-label={labels.view}>
          <button
            type="button"
            onClick={() => changeView("table")}
            aria-pressed={viewMode === "table"}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${viewMode === "table" ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}
          >
            <List className="h-4 w-4" aria-hidden="true" />{labels.tableView}
          </button>
          <button
            type="button"
            onClick={() => changeView("pipeline")}
            aria-pressed={viewMode === "pipeline"}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${viewMode === "pipeline" ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />{labels.pipelineView}
          </button>
        </div>
        <span className="text-xs font-black tabular-nums text-muted">{leads.length}</span>
      </div>

      {selectable && leads.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-3 py-2 xl:hidden">
          <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="h-5 w-5 rounded border-line text-ink focus:ring-ink" />
            {labels.selectAll}
          </label>
          <span className="text-xs font-bold text-muted">{selectedIds.length}/{leads.length}</span>
        </div>
      ) : null}

      {viewMode === "table" ? (
        <>
          <div className="hidden max-w-full overflow-x-auto xl:block">
            <table className="app-table min-w-[1120px]">
              <thead>
                <tr>
                  {selectable ? <th className="w-10"><input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label={labels.selectAllLeads} /></th> : null}
                  <th>Lead</th>
                  <th>{labels.phone}</th>
                  <th>{labels.region}</th>
                  <th>Status</th>
                  {showAssignee ? <th>{labels.salesperson}</th> : null}
                  <th>Termin</th>
                  <th className="min-w-[300px]">Szybkie akcje</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    {selectable ? <td><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => onToggle?.(lead.id)} aria-label={`${labels.selectLead} ${lead.full_name}`} /></td> : null}
                    <td className="min-w-[210px]">
                      <button type="button" onClick={() => setOpenLeadId(lead.id)} className="font-black text-ink hover:text-sky">{lead.full_name}</button>
                      <div className="mt-1.5 flex max-w-[260px] flex-wrap gap-1 text-[11px] font-bold">
                        <span className="rounded-md border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-sky">{formatSource(lead.source, language)}</span>
                        {lead.campaign ? <span className="max-w-[170px] truncate rounded-md border border-solar/25 bg-solar/10 px-1.5 py-0.5 text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</span> : null}
                        <span className="px-1 py-0.5 text-muted">{lead.postal_code || "—"}</span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-muted">Dodany: {formatDateTime(lead.created_at)}</div>
                    </td>
                    <td><a href={dialHref(lead.phone)} className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-ink hover:text-sky"><Phone className="h-4 w-4 text-muted" />{formatPhoneReadable(lead.phone)}</a></td>
                    <td className="max-w-[160px] text-muted"><div className="truncate">{lead.voivodeship || "—"}</div><div className="truncate text-xs">{lead.county || "—"}</div></td>
                    <td><StatusBadge status={lead.status} /></td>
                    {showAssignee ? <td className="max-w-[150px] truncate text-muted">{lead.assigned_profile?.full_name || labels.unassigned}</td> : null}
                    <td className="min-w-[150px] text-xs font-semibold text-muted">
                      {lead.callback_at ? <div className="font-bold text-sky">Call back<br />{formatDateTime(lead.callback_at)}</div> : null}
                      {lead.meeting_at ? <div className="font-bold text-leaf">Spotkanie<br />{formatDateTime(lead.meeting_at)}</div> : null}
                      {!lead.callback_at && !lead.meeting_at ? "—" : null}
                    </td>
                    <td>{fastActions(lead, "compact")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid min-w-0 gap-2 bg-[#f8fafc] p-2.5 xl:hidden">
            {leads.map((lead) => {
              const expanded = expandedLeadId === lead.id;
              return (
                <article key={lead.id} className={`min-w-0 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm transition ${expanded ? "border-sky/40 shadow-md" : "border-line"}`}>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <button type="button" onClick={() => toggleExpanded(lead.id)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
                      <span className="block max-w-full truncate text-base font-black text-ink">{lead.full_name}</span>
                      <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        <span className="rounded-md border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-sky">{formatSource(lead.source, language)}</span>
                        {lead.campaign ? <span className="max-w-[min(58vw,260px)] truncate rounded-md border border-solar/25 bg-solar/10 px-1.5 py-0.5 text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</span> : null}
                        <span className="text-muted">{lead.postal_code || "—"}</span>
                      </span>
                    </button>
                    <div className="flex flex-none items-center gap-1.5">
                      {selectable ? <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => onToggle?.(lead.id)} className="h-5 w-5 rounded border-line text-ink focus:ring-ink" aria-label={`${labels.selectLead} ${lead.full_name}`} /> : null}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(lead.id)}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition ${expanded ? "border-sky/30 bg-sky/10 text-sky" : "border-line bg-white text-muted"}`}
                        aria-label={expanded ? labels.collapseActions : labels.expandActions}
                        aria-expanded={expanded}
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
                    <StatusBadge status={lead.status} />
                    <a href={dialHref(lead.phone)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-black text-ink"><Phone className="h-4 w-4 text-muted" />{formatPhoneReadable(lead.phone)}</a>
                  </div>

                  <div className="mt-2.5 border-t border-line/70 pt-2.5">
                    <MetaLine lead={lead} showAssignee={showAssignee} labels={labels} />
                  </div>

                  {(accessToken || onQuickAction) ? (
                    expanded ? (
                      <div className="mt-3 border-t border-line/70 pt-3">
                        {accessToken ? (
                          <LeadInlineActions
                            lead={lead}
                            accessToken={accessToken}
                            onPreset={openPreset}
                            onComments={setCommentsLead}
                            onChanged={changed}
                            onOpenDetails={(item) => setOpenLeadId(item.id)}
                          />
                        ) : fastActions(lead)}
                      </div>
                    ) : (
                      <button type="button" onClick={() => toggleExpanded(lead.id)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-[#f8fafc] px-3 text-sm font-black text-ink transition active:scale-[.99]" aria-expanded={false}>
                        <span>{labels.expandActions}</span>
                        <ChevronDown className="h-4 w-4 text-muted" />
                      </button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="max-w-full overflow-x-auto overscroll-x-contain bg-[#f8fafc] p-2.5 pb-4" aria-label={labels.pipelineView}>
          <div className="flex min-w-max items-start gap-2.5">
            {pipelineGroups.map(({ status, leads: stageLeads }) => (
              <section key={status} className="w-[min(84vw,310px)] flex-none rounded-2xl border border-line bg-[#eef2f5] p-2.5 sm:w-[310px]">
                <header className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
                  <StatusBadge status={status} />
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black tabular-nums text-muted shadow-sm">{stageLeads.length}</span>
                </header>
                <div className="grid min-h-24 gap-2.5">
                  {stageLeads.map((lead) => (
                    <article key={lead.id} className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white p-3 shadow-sm transition hover:border-sky/30 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setOpenLeadId(lead.id)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-black text-ink hover:text-sky">{lead.full_name}</span>
                          <span className="mt-1 block truncate text-[11px] font-semibold text-muted">{lead.postal_code || "—"} · {formatSource(lead.source, language)}</span>
                        </button>
                        {selectable ? <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => onToggle?.(lead.id)} className="mt-0.5 h-5 w-5 flex-none rounded border-line text-ink focus:ring-ink" /> : null}
                      </div>
                      {lead.campaign ? <div className="mt-2 truncate rounded-md border border-solar/25 bg-solar/10 px-2 py-1 text-[11px] font-bold text-[#8a5a00]" title={lead.campaign}>{lead.campaign}</div> : null}
                      <a href={dialHref(lead.phone)} className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 text-sm font-black text-ink"><Phone className="h-4 w-4 text-muted" />{formatPhoneReadable(lead.phone)}</a>
                      <div className="mt-2 border-t border-line/70 pt-2"><MetaLine lead={lead} showAssignee={showAssignee} labels={labels} /></div>
                      {(accessToken || onQuickAction) ? <div className="mt-3 border-t border-line/70 pt-3">{fastActions(lead)}</div> : null}
                    </article>
                  ))}
                  {stageLeads.length === 0 ? <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-line bg-white/70 px-4 text-center text-xs font-semibold text-muted">{labels.emptyStage}</div> : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 ? <EmptyState title={labels.noLeads} description={labels.noLeadsDescription} className="m-3" /> : null}

      {presetAction ? (
        <LeadQuickActionDialog
          lead={presetAction.lead}
          accessToken={accessToken}
          initialOutcome={presetAction.outcome}
          onClose={() => setPresetAction(null)}
          onCompleted={changed}
        />
      ) : null}

      {commentsLead ? (
        <LeadCommentsDialog
          lead={commentsLead}
          accessToken={accessToken}
          onClose={() => setCommentsLead(null)}
          onChanged={changed}
        />
      ) : null}

      {openLeadId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-1.5 backdrop-blur-sm sm:p-3" onClick={closeLeadCard}>
          <div className="relative h-[96dvh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn-icon absolute right-2 top-2 z-20 bg-white shadow sm:right-3 sm:top-3" onClick={closeLeadCard} aria-label={language === "en" ? "Close" : "Zamknij"}><X className="h-5 w-5" /></button>
            <iframe title={language === "en" ? "Lead card" : "Karta leada"} src={`/leads/${openLeadId}?embedded=1`} className="h-full w-full border-0" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

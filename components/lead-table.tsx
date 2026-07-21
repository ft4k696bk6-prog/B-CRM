"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, Phone } from "lucide-react";
import { formatDateTime } from "@/lib/date";
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
};

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("48") ? digits.slice(2) : digits;
  const grouped = withoutCountry.replace(/(\d{3})(?=\d)/g, "$1 ").trim();

  if (!grouped) return phone;
  return digits.startsWith("48") ? `+48 ${grouped}` : grouped;
}

function phoneHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

function formatSource(source: string | null, language: "pl" | "en") {
  if (!source) return language === "en" ? "No source" : "Bez źródła";

  const normalized = source.toLowerCase();
  if (normalized === "własne" || normalized === "wlasne") {
    return language === "en" ? "Own" : "własne";
  }
  if (normalized === "polecenie") {
    return language === "en" ? "Referral" : "polecenie";
  }

  return source;
}

export function LeadTable({
  leads,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  showAssignee = false
}: LeadTableProps) {
  const { language } = useLanguage();
  const allSelected = leads.length > 0 && leads.every((lead) => selectedIds.includes(lead.id));
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
        noLeads: "No leads",
        noLeadsDescription: "No records for the selected filters."
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
        noLeads: "Brak leadów",
        noLeadsDescription: "Ten widok nie ma jeszcze rekordów dla wybranych filtrów."
      };

  return (
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
              <th className="w-12 px-3 py-3" />
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
                  <Link
                    href={`/leads/${lead.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink hover:text-sky"
                  >
                    {lead.full_name}
                  </Link>
                  <div className="mt-1 text-xs text-muted">
                    {formatSource(lead.source, language)} · {lead.postal_code || labels.noCode}
                  </div>
                </td>
                <td className="px-2 py-3 align-top">
                  <a
                    href={`tel:${phoneHref(lead.phone)}`}
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
                  <Link
                    href={`/leads/${lead.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted transition hover:border-ink hover:text-ink"
                    title={labels.openLeadCard}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
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
                <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer" className="text-base font-black text-ink hover:text-sky">
                  {lead.full_name}
                </Link>
                <div className="mt-1 text-xs font-semibold text-muted">
                  {formatSource(lead.source, language)} · {lead.postal_code || labels.noCode}
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
                href={`tel:${phoneHref(lead.phone)}`}
                className="inline-flex min-h-11 w-fit min-w-[154px] items-center gap-2 whitespace-nowrap font-bold text-ink"
              >
                <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                {formatPhone(lead.phone)}
              </a>
              <div className="grid gap-1 rounded-lg border border-line bg-[#f8fafc] p-3 text-xs font-semibold text-muted">
                <div>{labels.region}: {lead.voivodeship || "—"} / {lead.county || "—"}</div>
                <div>{labels.dates}: {lead.callback_at || lead.meeting_at ? [lead.callback_at, lead.meeting_at].filter(Boolean).map(formatDateTime).join(" · ") : "—"}</div>
                <div>{labels.created}: {formatDateTime(lead.created_at)}</div>
              </div>
            </div>

            <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {labels.openCard}
            </Link>
          </article>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState title={labels.noLeads} description={labels.noLeadsDescription} className="m-3" />
      ) : null}
    </div>
  );
}

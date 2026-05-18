"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, Phone } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";

type LeadTableProps = {
  leads: Lead[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  showAssignee?: boolean;
};

export function LeadTable({
  leads,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  showAssignee = false
}: LeadTableProps) {
  const allSelected = leads.length > 0 && leads.every((lead) => selectedIds.includes(lead.id));

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
            Zaznacz wszystkie
          </label>
          <span className="text-xs font-bold text-muted">{selectedIds.length}/{leads.length}</span>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="app-table min-w-[960px]">
          <thead>
            <tr>
              {selectable ? (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-4 w-4 rounded border-line text-ink focus:ring-ink"
                    aria-label="Zaznacz wszystkie leady"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Status</th>
              {showAssignee ? <th className="px-4 py-3">Handlowiec</th> : null}
              <th className="px-4 py-3">Terminy</th>
              <th className="px-4 py-3">Dodany</th>
              <th className="w-12 px-4 py-3" />
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
                      aria-label={`Zaznacz ${lead.full_name}`}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-semibold text-ink hover:text-sky"
                  >
                    {lead.full_name}
                  </Link>
                  <div className="mt-1 text-xs text-muted">
                    {lead.source || "Bez źródła"} · {lead.postal_code || "brak kodu"}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-2 font-semibold text-ink hover:text-sky"
                  >
                    <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                    {lead.phone}
                  </a>
                </td>
                <td className="px-4 py-3 align-top text-muted">
                  <div>{lead.voivodeship || "—"}</div>
                  <div className="text-xs">{lead.county || "—"}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusBadge status={lead.status} />
                </td>
                {showAssignee ? (
                  <td className="px-4 py-3 align-top text-muted">
                    {lead.assigned_profile?.full_name || "Nieprzypisany"}
                  </td>
                ) : null}
                <td className="px-4 py-3 align-top text-muted">
                  {lead.callback_at ? (
                    <div className="mb-1 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      {formatDateTime(lead.callback_at)}
                    </div>
                  ) : null}
                  {lead.meeting_at ? <div>{formatDateTime(lead.meeting_at)}</div> : null}
                  {!lead.callback_at && !lead.meeting_at ? "—" : null}
                </td>
                <td className="px-4 py-3 align-top text-muted">
                  {formatDateTime(lead.created_at)}
                </td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted transition hover:border-ink hover:text-ink"
                    title="Otwórz kartę leada"
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
                <Link href={`/leads/${lead.id}`} className="text-base font-black text-ink hover:text-sky">
                  {lead.full_name}
                </Link>
                <div className="mt-1 text-xs font-semibold text-muted">
                  {lead.source || "Bez źródła"} · {lead.postal_code || "brak kodu"}
                </div>
              </div>
              {selectable ? (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(lead.id)}
                  onChange={() => onToggle?.(lead.id)}
                  className="mt-1 h-5 w-5 flex-none rounded border-line text-ink focus:ring-ink"
                  aria-label={`Zaznacz ${lead.full_name}`}
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              {showAssignee ? (
                <span className="rounded-md border border-line bg-[#f8fafc] px-2 py-1 text-xs font-bold text-muted">
                  {lead.assigned_profile?.full_name || "Nieprzypisany"}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <a href={`tel:${lead.phone}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-ink">
                <Phone className="h-4 w-4 text-muted" aria-hidden="true" />
                {lead.phone}
              </a>
              <div className="grid gap-1 rounded-lg border border-line bg-[#f8fafc] p-3 text-xs font-semibold text-muted">
                <div>Region: {lead.voivodeship || "—"} / {lead.county || "—"}</div>
                <div>Terminy: {lead.callback_at || lead.meeting_at ? [lead.callback_at, lead.meeting_at].filter(Boolean).map(formatDateTime).join(" · ") : "—"}</div>
                <div>Dodany: {formatDateTime(lead.created_at)}</div>
              </div>
            </div>

            <Link href={`/leads/${lead.id}`} className="btn-secondary mt-4 w-full">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Otwórz kartę
            </Link>
          </article>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState title="Brak leadów" description="Ten widok nie ma jeszcze rekordów dla wybranych filtrów." className="m-3" />
      ) : null}
    </div>
  );
}

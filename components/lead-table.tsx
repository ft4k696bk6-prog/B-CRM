"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, Phone } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

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
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b border-line bg-[#f9fbfd] text-xs uppercase tracking-wide text-muted">
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
          <tbody className="divide-y divide-line">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-[#fbfcfe]">
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
      {leads.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm font-semibold text-muted">
          Brak leadów w tym widoku.
        </div>
      ) : null}
    </div>
  );
}

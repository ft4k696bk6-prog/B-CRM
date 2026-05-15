"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/date";
import type { DailyReport } from "@/lib/types";
import { BarChart3, Loader2 } from "lucide-react";

type DailyReportViewProps = {
  userId: string;
  reportDate: string;
  token: string;
};

export function DailyReportView({
  userId,
  reportDate,
  token
}: DailyReportViewProps) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReport();
  }, [userId, reportDate]);

  async function loadReport() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/leads/reports?user_id=${userId}&report_date=${reportDate}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Nie udało się załadować raportu");
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-muted">Brak raportu dla tego dnia</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-danger/10 p-4 text-danger">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-solar" />
          <h3 className="font-semibold text-ink">Raport dnia</h3>
          <span className="ml-auto text-sm text-muted">
            {formatDateTime(report.created_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Leady pracowane</p>
            <p className="text-lg font-bold text-ink">{report.total_leads_worked}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Aktywności</p>
            <p className="text-lg font-bold text-ink">{report.total_activities}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Rozmowy</p>
            <p className="text-lg font-bold text-solar">{report.calls_made}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Spotkania</p>
            <p className="text-lg font-bold text-leaf">{report.meetings_scheduled}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Umowy</p>
            <p className="text-lg font-bold text-green">{report.contracts_signed}</p>
          </div>
          <div className="rounded-lg bg-white p-3 border border-line">
            <p className="text-xs text-muted mb-1">Rezygnacje</p>
            <p className="text-lg font-bold text-danger">{report.resignations_recorded}</p>
          </div>
        </div>

        {report.summary && (
          <div className="mt-4 rounded-lg bg-sky/10 p-3 border border-sky/20">
            <p className="text-sm text-text">{report.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

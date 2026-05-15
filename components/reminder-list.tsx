"use client";

import { useEffect, useState } from "react";
import type { LeadReminder } from "@/lib/types";
import { formatDateTime } from "@/lib/date";
import { Calendar, Check, Loader2, Plus } from "lucide-react";

type ReminderListProps = {
  leadId: string;
  token: string;
  onAddReminder?: () => void;
};

export function ReminderList({
  leadId,
  token,
  onAddReminder
}: ReminderListProps) {
  const [reminders, setReminders] = useState<LeadReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReminders();
  }, [leadId]);

  async function loadReminders() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leads/reminders?lead_id=${leadId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Nie udało się załadować przypomnień");
      }

      const data = await response.json();
      setReminders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  async function toggleReminder(id: string, isCompleted: boolean) {
    try {
      const response = await fetch(`/api/leads/reminders`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id,
          is_completed: !isCompleted
        })
      });

      if (!response.ok) {
        throw new Error("Nie udało się zaktualizować przypomnienia");
      }

      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    }
  }

  const upcomingReminders = reminders.filter((r) => !r.is_completed);
  const completedReminders = reminders.filter((r) => r.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
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

      {onAddReminder && (
        <button
          onClick={onAddReminder}
          className="w-full flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted hover:border-line/50 hover:bg-surface/50"
        >
          <Plus className="h-4 w-4" />
          Dodaj przypomnienie
        </button>
      )}

      {reminders.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="text-muted">Brak przypomnień</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingReminders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted mb-2 uppercase">
                Nadchodzące
              </h3>
              <div className="space-y-2">
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <button
                      onClick={() =>
                        toggleReminder(reminder.id, reminder.is_completed)
                      }
                      className="mt-1 rounded border border-line p-1 hover:bg-surface/50"
                    >
                      <Check className="h-4 w-4 text-muted" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="h-4 w-4 text-solar" flex-shrink-0 />
                        <p className="font-medium text-sm">{reminder.title}</p>
                      </div>
                      {reminder.description && (
                        <p className="text-xs text-muted mt-1">
                          {reminder.description}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-1">
                        {formatDateTime(reminder.reminder_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedReminders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted mb-2 uppercase">
                Zakończone
              </h3>
              <div className="space-y-2">
                {completedReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-start gap-3 rounded-lg border border-line bg-surface/50 p-3 opacity-60"
                  >
                    <button
                      onClick={() =>
                        toggleReminder(reminder.id, reminder.is_completed)
                      }
                      className="mt-1 rounded border border-line p-1 bg-leaf/10"
                    >
                      <Check className="h-4 w-4 text-leaf" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-through">
                        {reminder.title}
                      </p>
                      {reminder.completed_at && (
                        <p className="text-xs text-muted mt-1">
                          Zakończone {formatDateTime(reminder.completed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

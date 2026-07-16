"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/date";
import type { LeadActivity } from "@/lib/types";
import { ACTION_LABELS } from "@/lib/constants";
import { MessageSquarePlus, FileText, Calendar, Loader2 } from "lucide-react";

type ActivityLogProps = {
  leadId: string;
  token: string;
};

export function ActivityLog({ leadId, token }: ActivityLogProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadActivities();
  }, [leadId]);

  async function loadActivities() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/leads/activities?lead_id=${leadId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Nie udało się załadować aktywności");
      }

      const data = await response.json();
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "comment":
        return <MessageSquarePlus className="h-4 w-4" />;
      case "file_uploaded":
      case "file_deleted":
        return <FileText className="h-4 w-4" />;
      case "callback_scheduled":
      case "meeting_scheduled":
        return <Calendar className="h-4 w-4" />;
      default:
        return <MessageSquarePlus className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "comment":
        return "bg-blue/10 text-blue";
      case "file_uploaded":
        return "bg-green/10 text-leaf";
      case "file_deleted":
        return "bg-danger/10 text-danger";
      case "status_change":
        return "bg-solar/20 text-[#8a5a00]";
      case "callback_scheduled":
        return "bg-[#e8f7f0] text-[#1d7556]";
      case "meeting_scheduled":
        return "bg-[#eef8e8] text-[#31701f]";
      default:
        return "bg-muted/10 text-muted";
    }
  };

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

      {activities.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="text-muted">Brak aktywności dla tego leada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-lg border border-line bg-surface p-4 hover:border-line/50"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full p-2 ${getActivityColor(
                    activity.activity_type
                  )}`}
                >
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">
                      {ACTION_LABELS[activity.activity_type] ||
                        activity.activity_type}
                    </p>
                    {activity.user_profile && (
                      <span className="text-xs text-muted">
                        - {activity.user_profile.full_name}
                      </span>
                    )}
                  </div>
                  {activity.title && (
                    <p className="text-sm text-text mt-1">{activity.title}</p>
                  )}
                  {activity.description && (
                    <p className="text-sm text-muted mt-1">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-2">
                    {formatDateTime(activity.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

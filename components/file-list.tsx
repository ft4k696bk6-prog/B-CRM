"use client";

import { useEffect, useState } from "react";
import type { LeadFile } from "@/lib/types";
import { formatDateTime } from "@/lib/date";
import { FileText, Loader2, Trash2 } from "lucide-react";

type FileListProps = {
  leadId: string;
  token: string;
};

export function FileList({ leadId, token }: FileListProps) {
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFiles();
  }, [leadId]);

  async function loadFiles() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leads/files?lead_id=${leadId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Nie udało się załadować plików");
      }

      const data = await response.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

      {files.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="text-muted">Brak przesłanych plików</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line/50"
            >
              <FileText className="h-5 w-5 text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted mt-1">
                  {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                  {file.user_profile && (
                    <span>Przesłane przez {file.user_profile.full_name}</span>
                  )}
                  <span>{formatDateTime(file.created_at)}</span>
                </div>
                {file.description && (
                  <p className="text-xs text-text mt-1">{file.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

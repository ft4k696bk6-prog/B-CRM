"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { Alert, EmptyState, ModalShell } from "@/components/ui";
import type { Lead, LeadActivity } from "@/lib/types";

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function LeadCommentsDialog({
  lead,
  accessToken,
  onClose,
  onChanged
}: {
  lead: Lead | null;
  accessToken: string;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const [comments, setComments] = useState<LeadActivity[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadComments = useCallback(async () => {
    if (!lead || !accessToken) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ lead_id: lead.id, type: "comment" });
    const response = await fetch(`/api/leads/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const body = await response.json().catch(() => []);
    if (!response.ok) setError(body?.error || "Nie udało się pobrać komentarzy.");
    else setComments((body || []) as LeadActivity[]);
    setLoading(false);
  }, [accessToken, lead]);

  useEffect(() => {
    setNote("");
    setComments([]);
    setError("");
    void loadComments();
  }, [loadComments]);

  if (!lead) return null;
  const currentLead = lead;

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const description = note.trim();
    if (!description || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/leads/activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        lead_id: currentLead.id,
        activity_type: "comment",
        title: "Komentarz",
        description
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Nie udało się dodać komentarza.");
      setSaving(false);
      return;
    }
    setNote("");
    await loadComments();
    await onChanged?.();
    setSaving(false);
  }

  return (
    <ModalShell
      open
      onClose={() => !saving && onClose()}
      title={`Komentarze · ${currentLead.full_name}`}
      description="Tylko notatki do leada, bez pozostałej historii zmian."
      size="sm"
    >
      <form onSubmit={addComment} className="sticky top-0 z-10 mb-4 rounded-xl border border-line bg-white p-3 shadow-sm">
        <label>
          <span className="label">Szybki komentarz</span>
          <textarea
            className="field min-h-24 resize-y"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Np. klient prosi o kontakt po wypłacie, ma sprawdzić rachunek…"
            maxLength={4000}
          />
        </label>
        <button type="submit" className="btn-primary mt-2 w-full sm:w-auto" disabled={!note.trim() || saving}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {saving ? "Zapisywanie…" : "Dodaj komentarz"}
        </button>
      </form>

      {error ? <Alert tone="danger" className="mb-3">{error}</Alert> : null}

      <div className="grid gap-2.5">
        {loading ? (
          <div className="rounded-xl border border-line bg-[#f8fafc] p-4 text-sm font-semibold text-muted">Pobieranie komentarzy…</div>
        ) : comments.length ? (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border border-line bg-[#f8fafc] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs font-black text-ink">
                  <MessageSquareText className="h-4 w-4 flex-none text-sky" aria-hidden="true" />
                  <span className="truncate">{comment.user_profile?.full_name || comment.user_profile?.email || "Użytkownik"}</span>
                </div>
                <time className="flex-none text-[11px] font-semibold text-muted">{formatCommentDate(comment.created_at)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{comment.description || comment.title}</p>
            </article>
          ))
        ) : (
          <EmptyState title="Brak komentarzy" description="Pierwszy komentarz możesz dodać powyżej." />
        )}
      </div>
    </ModalShell>
  );
}

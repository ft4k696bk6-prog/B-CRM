"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { Alert, SectionHeader } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

type PushRecipient = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  activePushDevices: number;
};

export function OwnerOneOffPush() {
  const { profile, session } = useAuth();
  const [recipients, setRecipients] = useState<PushRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("B-CRM");
  const [body, setBody] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.activePushDevices > 0),
    [recipients],
  );

  useEffect(() => {
    if (profile?.role !== "owner" || !session?.access_token) return;

    let cancelled = false;
    setLoadingRecipients(true);
    setError("");

    fetch("/api/push/one-off", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Nie udało się pobrać odbiorców.");
        if (!cancelled) setRecipients(data.recipients || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Nie udało się pobrać odbiorców.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.role, session?.access_token]);

  if (profile?.role !== "owner") return null;

  function toggleRecipient(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function selectAllActive() {
    setSelectedIds(activeRecipients.map((recipient) => recipient.id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || sending) return;

    setError("");
    setSuccess("");
    setSending(true);

    try {
      const response = await fetch("/api/push/one-off", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recipientIds: selectedIds, title, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się wysłać powiadomienia.");

      setSuccess(
        `Wysłano do ${data.sentDevices || 0} urządzeń (${data.recipients || 0} wybranych użytkowników).`,
      );
      setBody("");
      setSelectedIds([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się wysłać powiadomienia.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="app-card max-w-3xl">
      <SectionHeader
        icon={BellRing}
        title="Jednorazowe powiadomienie push"
        description="Tylko właściciel. Wysyłka natychmiastowa do wybranych użytkowników, którzy mają aktywne powiadomienia na telefonie lub komputerze."
        tone="solar"
        className="mb-4"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Tytuł</span>
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="B-CRM"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Treść</span>
          <textarea
            className="field min-h-24"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            placeholder="Wpisz treść jednorazowego powiadomienia..."
            required
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">Odbiorcy</span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={selectAllActive} disabled={!activeRecipients.length}>
            Zaznacz aktywnych
          </button>
          <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>
            Wyczyść
          </button>
        </div>
      </div>

      <div className="mt-2 grid max-h-72 gap-2 overflow-auto rounded-lg border border-line bg-[#f9fbfd] p-3 sm:grid-cols-2">
        {loadingRecipients ? (
          <div className="text-sm text-muted">Pobieram użytkowników...</div>
        ) : recipients.length ? (
          recipients.map((recipient) => {
            const disabled = recipient.activePushDevices < 1;
            return (
              <label
                key={recipient.id}
                className={`flex items-start gap-3 rounded-md border p-3 ${disabled ? "border-line bg-white/60 opacity-60" : "border-line bg-white"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={selectedIds.includes(recipient.id)}
                  disabled={disabled}
                  onChange={() => toggleRecipient(recipient.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{recipient.full_name}</span>
                  <span className="block truncate text-xs text-muted">
                    {recipient.role} · {disabled ? "brak aktywnego push" : `${recipient.activePushDevices} urządzenie${recipient.activePushDevices === 1 ? "" : "a"}`}
                  </span>
                </span>
              </label>
            );
          })
        ) : (
          <div className="text-sm text-muted">Brak użytkowników do wyświetlenia.</div>
        )}
      </div>

      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
      {success ? <Alert tone="success" className="mt-4">{success}</Alert> : null}

      <button type="submit" className="btn-primary mt-4" disabled={sending || !selectedIds.length || !body.trim()}>
        <Send className="h-4 w-4" aria-hidden="true" />
        {sending ? "Wysyłanie..." : "Wyślij teraz"}
      </button>
    </form>
  );
}

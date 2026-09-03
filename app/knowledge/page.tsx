"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, FolderOpen, Mail, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

type Article = { id: string; title: string; category: string; content: string; source_url: string | null; updated_at: string };
type DriveFile = { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink?: string };
type MailMessage = { id: string; from: string; subject: string; date: string; snippet: string; url: string };

export default function KnowledgePage() {
  const { loading, profile, session } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]); const [drive, setDrive] = useState<DriveFile[]>([]); const [mail, setMail] = useState<MailMessage[]>([]);
  const [query, setQuery] = useState(""); const [error, setError] = useState(""); const [integrationNotes, setIntegrationNotes] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Ogólne", content: "", sourceUrl: "" });
  const canEdit = profile?.role === "owner" || profile?.role === "admin";

  const headers = useCallback(() => ({ Authorization: `Bearer ${session?.access_token || ""}` }), [session?.access_token]);
  const load = useCallback(async () => {
    if (!session?.access_token) return; setBusy(true); setError(""); setIntegrationNotes([]);
    const [knowledgeResponse, driveResponse, mailResponse] = await Promise.all([
      fetch(`/api/knowledge?q=${encodeURIComponent(query)}`, { headers: headers(), cache: "no-store" }),
      fetch("/api/integrations/google-drive", { headers: headers(), cache: "no-store" }),
      fetch("/api/integrations/gmail", { headers: headers(), cache: "no-store" })
    ]);
    const [knowledgeBody, driveBody, mailBody] = await Promise.all([knowledgeResponse.json(), driveResponse.json(), mailResponse.json()]);
    if (knowledgeResponse.ok) setArticles(knowledgeBody.articles || []); else setError(knowledgeBody.error || "Nie udało się pobrać wiedzy.");
    if (driveResponse.ok) setDrive(driveBody.files || []); else setIntegrationNotes((current) => [...current, `Drive: ${driveBody.error}`]);
    if (mailResponse.ok) setMail(mailBody.messages || []); else setIntegrationNotes((current) => [...current, `Poczta: ${mailBody.error}`]);
    setBusy(false);
  }, [headers, query, session?.access_token]);
  useEffect(() => { void load(); }, [load]);

  async function addArticle(event: FormEvent) {
    event.preventDefault(); if (!session?.access_token) return; setBusy(true); setError("");
    const response = await fetch("/api/knowledge", { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json(); if (!response.ok) setError(body.error || "Nie udało się zapisać artykułu.");
    else { setForm({ title: "", category: "Ogólne", content: "", sourceUrl: "" }); await load(); } setBusy(false);
  }
  async function removeArticle(id: string) { if (!session?.access_token) return; const response = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE", headers: headers() }); if (response.ok) setArticles((current) => current.filter((item) => item.id !== id)); }

  if (loading || !profile) return <LoadingScreen />;
  return <AppShell profile={profile}><div className="grid gap-5">
    <PageHeader title="Skarbnica wiedzy" description="Procedury, dokumenty Google Drive i skrzynka firmowa w jednym miejscu." actions={<button type="button" className="btn-secondary min-h-11" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Odśwież</button>} />
    {error ? <Alert tone="danger">{error}</Alert> : null}{integrationNotes.map((note) => <Alert key={note} tone="warning">{note}</Alert>)}
    <section className="app-card"><SectionHeader icon={Search} title="Szukaj w wiedzy" tone="sky" /><div className="mt-4 flex gap-2"><input className="field min-h-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procedura, produkt, obiekcja klienta…" /><button className="btn-primary min-h-11" onClick={() => void load()}>Szukaj</button></div></section>
    {canEdit ? <form className="app-card" onSubmit={addArticle}><SectionHeader icon={Plus} title="Dodaj materiał" tone="leaf" /><div className="mt-4 grid gap-3 md:grid-cols-2"><input className="field min-h-11" placeholder="Tytuł" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /><input className="field min-h-11" placeholder="Kategoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><input className="field min-h-11 md:col-span-2" placeholder="Link źródłowy (opcjonalnie)" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /><textarea className="field min-h-32 md:col-span-2" placeholder="Treść instrukcji" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required /></div><button className="btn-primary mt-3 min-h-11" disabled={busy}>Zapisz materiał</button></form> : null}
    <section className="app-card"><SectionHeader icon={BookOpen} title="Baza wiedzy" description={`${articles.length} materiałów`} tone="solar" /><div className="mt-4 grid gap-3 md:grid-cols-2">{articles.map((article) => <article key={article.id} className="rounded-lg border border-line bg-[#f9fbfd] p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded bg-sky/10 px-2 py-1 text-xs font-bold text-sky">{article.category}</span><h3 className="mt-2 font-black text-ink">{article.title}</h3></div>{canEdit ? <button className="btn-icon min-h-11 min-w-11 text-danger" onClick={() => void removeArticle(article.id)} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button> : null}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{article.content}</p>{article.source_url ? <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-sky" href={article.source_url} target="_blank" rel="noreferrer">Otwórz źródło<ExternalLink className="h-4 w-4" /></a> : null}</article>)}{articles.length === 0 ? <EmptyState title="Brak materiałów" description="Dodaj pierwszą procedurę lub instrukcję." /> : null}</div></section>
    <div className="grid gap-5 xl:grid-cols-2"><section className="app-card"><SectionHeader icon={FolderOpen} title="Google Drive" description={`${drive.length} ostatnich plików`} tone="leaf" /><div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto">{drive.map((file) => <a key={file.id} href={file.webViewLink} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line p-3 hover:border-leaf"><span className="truncate font-bold">{file.name}</span><ExternalLink className="h-4 w-4 flex-none" /></a>)}</div></section><section className="app-card"><SectionHeader icon={Mail} title="Skrzynka mailowa" description={`${mail.length} ostatnich wiadomości`} tone="sky" /><div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto">{mail.map((message) => <a key={message.id} href={message.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-line p-3 hover:border-sky"><div className="truncate font-black">{message.subject}</div><div className="mt-1 truncate text-xs font-bold text-sky">{message.from}</div><p className="mt-2 line-clamp-2 text-sm text-muted">{message.snippet}</p></a>)}</div></section></div>
  </div></AppShell>;
}

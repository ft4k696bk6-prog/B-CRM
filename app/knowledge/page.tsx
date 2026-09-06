"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronDown, ExternalLink, FileText, Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { PhMaterialsBrowser } from "@/components/ph-materials-browser";
import { Alert, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

type Article = {
  id: string;
  title: string;
  category: string;
  content: string;
  source_url: string | null;
  updated_at: string;
  built_in?: boolean;
};

export default function KnowledgePage() {
  const { loading, profile, session } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Ogólne", content: "", sourceUrl: "" });
  const canEdit = profile?.role === "owner" || profile?.role === "admin";

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${session?.access_token || ""}` }),
    [session?.access_token]
  );

  const loadCategories = useCallback(async () => {
    if (!session?.access_token) return;
    const response = await fetch("/api/knowledge?categories=1", {
      headers: headers(),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setCategories(body.categories || []);
    else setError(body.error || "Nie udało się pobrać kategorii.");
  }, [headers, session?.access_token]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function loadArticles(category = selectedCategory, search = query) {
    if (!session?.access_token || !category) return;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ category });
    if (search.trim()) params.set("q", search.trim());
    const response = await fetch(`/api/knowledge?${params}`, {
      headers: headers(),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setArticles(body.articles || []);
    else setError(body.error || "Nie udało się pobrać materiałów.");
    setBusy(false);
  }

  async function chooseCategory(category: string) {
    setSelectedCategory(category);
    setQuery("");
    await loadArticles(category, "");
  }

  async function addArticle(event: FormEvent) {
    event.preventDefault();
    if (!session?.access_token) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Nie udało się zapisać materiału.");
    } else {
      setForm({ title: "", category: selectedCategory || "Ogólne", content: "", sourceUrl: "" });
      setFormOpen(false);
      await loadCategories();
      if (selectedCategory === body.article?.category) await loadArticles();
    }
    setBusy(false);
  }

  async function removeArticle(id: string) {
    if (!session?.access_token) return;
    const response = await fetch(`/api/knowledge?id=${id}`, {
      method: "DELETE",
      headers: headers()
    });
    if (response.ok) setArticles((current) => current.filter((item) => item.id !== id));
  }

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title="Skarbnica wiedzy"
          description="Materiały PH z firmowego Google Drive oraz krótkie procedury i instrukcje CRM."
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {session?.access_token ? <PhMaterialsBrowser accessToken={session.access_token} /> : null}

        <section className="app-card">
          <SectionHeader
            icon={BookOpen}
            title="Procedury i wiedza CRM"
            description="Krótkie instrukcje do sprzedaży, umów, realizacji i rozliczeń."
            tone="solar"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => void chooseCategory(category)}
                className={`min-h-11 rounded-xl border px-4 text-sm font-bold transition active:scale-[.97] ${
                  selectedCategory === category
                    ? "border-sky bg-sky text-white shadow-sm"
                    : "border-line bg-white text-ink hover:border-sky/50 hover:bg-sky/5"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {selectedCategory ? (
          <section className="app-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                icon={FileText}
                title={selectedCategory}
                description={`${articles.length} materiałów`}
                tone="sky"
              />
              <label className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <span className="sr-only">Szukaj w kategorii</span>
                <input
                  className="field min-h-11 pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadArticles();
                  }}
                  placeholder="Szukaj w tej kategorii"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {busy ? (
                <LoadingScreen label="Pobieranie materiałów" />
              ) : (
                articles.map((article) => (
                  <article key={article.id} className="rounded-xl border border-line bg-[#f9fbfd] p-4 transition hover:border-sky/30">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-ink">{article.title}</h3>
                      {canEdit && !article.built_in ? (
                        <button
                          type="button"
                          className="btn-icon min-h-11 min-w-11 text-danger"
                          onClick={() => void removeArticle(article.id)}
                          aria-label={`Usuń: ${article.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{article.content}</p>
                    {article.source_url ? (
                      <a
                        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky"
                        href={article.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Otwórz źródło
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </article>
                ))
              )}
              {!busy && !articles.length ? (
                <EmptyState
                  title="Brak materiałów w tej kategorii"
                  description="Wybierz inną kategorię albo dodaj nowy materiał."
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {canEdit ? (
          <section className="app-card p-0">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between px-5 text-left font-black"
              onClick={() => setFormOpen((value) => !value)}
              aria-expanded={formOpen}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-leaf" />
                Dodaj własny materiał tekstowy
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${formOpen ? "rotate-180" : ""}`} />
            </button>
            {formOpen ? (
              <form className="grid gap-3 border-t border-line p-5 md:grid-cols-2" onSubmit={addArticle}>
                <label>
                  <span className="label">Tytuł</span>
                  <input className="field min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                </label>
                <label>
                  <span className="label">Kategoria</span>
                  <input className="field min-h-11" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
                </label>
                <label className="md:col-span-2">
                  <span className="label">Link źródłowy (opcjonalnie)</span>
                  <input className="field min-h-11" type="url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="label">Treść instrukcji</span>
                  <textarea className="field min-h-32" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
                </label>
                <button className="btn-primary min-h-11 md:col-span-2 md:justify-self-start" disabled={busy}>
                  Zapisz materiał
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

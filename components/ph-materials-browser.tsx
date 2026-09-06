"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  X
} from "lucide-react";
import { Alert, EmptyState, SectionHeader } from "@/components/ui";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
};

type FolderCrumb = { id: string; name: string };

type BrowserResponse = {
  rootId: string;
  folder: { id: string; name: string; parents?: string[] };
  items: DriveItem[];
  error?: string;
};

function fileIcon(item: DriveItem) {
  if (item.mimeType === FOLDER_MIME) return Folder;
  if (item.mimeType.startsWith("image/")) return FileImage;
  if (item.mimeType === "application/pdf") return FileText;
  return File;
}

function prettySize(value?: string) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function PhMaterialsBrowser({ accessToken }: { accessToken: string }) {
  const [crumbs, setCrumbs] = useState<FolderCrumb[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadFolder = useCallback(async (folderId?: string, push = false) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (folderId) params.set("folder_id", folderId);
    const response = await fetch(`/api/knowledge/ph-materials?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const body = (await response.json().catch(() => ({}))) as BrowserResponse;
    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać Materiałów PH.");
      setLoading(false);
      return;
    }
    setItems(body.items || []);
    setCrumbs((current) => {
      const rootCrumb = { id: body.rootId, name: body.folder.id === body.rootId ? body.folder.name : "Materiały PH Re-Energy System" };
      if (!folderId || body.folder.id === body.rootId) return [rootCrumb];
      if (push) return [...current, { id: body.folder.id, name: body.folder.name }];
      const existingIndex = current.findIndex((item) => item.id === body.folder.id);
      if (existingIndex >= 0) return current.slice(0, existingIndex + 1);
      return [rootCrumb, { id: body.folder.id, name: body.folder.name }];
    });
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void loadFolder();
  }, [loadFolder]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function openFolder(item: DriveItem) {
    await loadFolder(item.id, true);
  }

  async function previewImage(item: DriveItem) {
    if (!accessToken) return;
    setPreviewLoading(true);
    setError("");
    const response = await fetch(`/api/knowledge/ph-materials?file_id=${encodeURIComponent(item.id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "force-cache"
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Nie udało się otworzyć podglądu.");
      setPreviewLoading(false);
      return;
    }
    const blob = await response.blob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewName(item.name);
    setPreviewLoading(false);
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewName("");
  }

  const current = crumbs[crumbs.length - 1];
  const folders = items.filter((item) => item.mimeType === FOLDER_MIME).length;
  const files = items.length - folders;

  return (
    <section className="app-card min-w-0">
      <SectionHeader
        icon={FolderOpen}
        title="Materiały PH Re-Energy System"
        description="Cała firmowa baza z Google Drive: prezentacje, karty katalogowe, skrypty, realizacje, umowy i pozostałe materiały."
        tone="leaf"
      />

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[#f8fafc] p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 text-xs font-bold text-muted">
          {crumbs.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex flex-none items-center gap-1">
              {index > 0 ? <span>/</span> : null}
              <button type="button" className={index === crumbs.length - 1 ? "text-ink" : "text-sky hover:underline"} onClick={() => void loadFolder(crumb.id, false)}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {crumbs.length > 1 ? (
            <button type="button" className="btn-secondary min-h-10 px-3" onClick={() => void loadFolder(crumbs[crumbs.length - 2]?.id, false)}>
              <ArrowLeft className="h-4 w-4" />Wstecz
            </button>
          ) : null}
          <button type="button" className="btn-icon min-h-10 min-w-10" onClick={() => void loadFolder(current?.id, false)} aria-label="Odśwież Materiały PH">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!loading ? <div className="mb-3 text-xs font-bold text-muted">Foldery: {folders} · Pliki: {files}</div> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-line bg-[#f4f6f8]" />)}
        </div>
      ) : items.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = fileIcon(item);
            const folder = item.mimeType === FOLDER_MIME;
            const image = item.mimeType.startsWith("image/");
            return (
              <article key={item.id} className="group min-w-0 rounded-xl border border-line bg-white p-3 shadow-sm transition hover:border-sky/30 hover:shadow-md">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${folder ? "bg-solar/10 text-[#8a5a00]" : image ? "bg-leaf/10 text-leaf" : "bg-sky/10 text-sky"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-black leading-5 text-ink">{item.name}</h3>
                    {!folder ? <p className="mt-1 text-[11px] font-semibold text-muted">{prettySize(item.size) || item.mimeType}</p> : <p className="mt-1 text-[11px] font-semibold text-muted">Folder</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {folder ? (
                    <button type="button" onClick={() => void openFolder(item)} className="btn-secondary min-h-10 flex-1">
                      <Folder className="h-4 w-4" />Otwórz
                    </button>
                  ) : (
                    <>
                      {image ? (
                        <button type="button" onClick={() => void previewImage(item)} className="btn-secondary min-h-10 flex-1" disabled={previewLoading}>
                          <ImageIcon className="h-4 w-4" />Podgląd
                        </button>
                      ) : null}
                      {item.webViewLink ? (
                        <a href={item.webViewLink} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 flex-1">
                          <ExternalLink className="h-4 w-4" />Drive
                        </a>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Ten folder jest pusty" description="Wybierz inny folder z Materiałów PH." />
      )}

      {previewUrl ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm" onClick={closePreview}>
          <div className="relative max-h-[96dvh] max-w-[96vw] overflow-auto rounded-2xl bg-white p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn-icon absolute right-3 top-3 z-10 bg-white shadow" onClick={closePreview} aria-label="Zamknij podgląd">
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={previewName} className="max-h-[90dvh] max-w-[92vw] rounded-xl object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

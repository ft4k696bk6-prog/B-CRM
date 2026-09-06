"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Play,
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
  if (item.mimeType.startsWith("video/")) return Play;
  if (
    item.mimeType === "application/pdf" ||
    item.mimeType.startsWith("application/vnd.google-apps.")
  ) {
    return FileText;
  }
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
  const [previewMime, setPreviewMime] = useState("");
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
      setError(body.error || "Nie udało się pobrać materiałów.");
      setLoading(false);
      return;
    }
    setItems(body.items || []);
    setCrumbs((current) => {
      const rootCrumb = {
        id: body.rootId,
        name: body.folder.id === body.rootId ? "Skarbnica" : "Skarbnica"
      };
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

  async function fetchFile(item: DriveItem) {
    const response = await fetch(
      `/api/knowledge/ph-materials?file_id=${encodeURIComponent(item.id)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Nie udało się otworzyć pliku.");
    }
    return response;
  }

  async function openFile(item: DriveItem) {
    if (!accessToken) return;
    setPreviewLoading(true);
    setError("");
    try {
      const response = await fetchFile(item);
      const blob = await response.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewName(item.name);
      setPreviewMime(response.headers.get("content-type") || blob.type || item.mimeType);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Nie udało się otworzyć pliku.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadFile(item: DriveItem) {
    setError("");
    try {
      const response = await fetchFile(item);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = response.headers.get("content-type") === "application/pdf" && !item.name.toLowerCase().endsWith(".pdf")
        ? `${item.name}.pdf`
        : item.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Nie udało się pobrać pliku.");
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewName("");
    setPreviewMime("");
  }

  const current = crumbs[crumbs.length - 1];
  const atRoot = crumbs.length <= 1;
  const folders = items.filter((item) => item.mimeType === FOLDER_MIME).length;
  const files = items.length - folders;

  return (
    <section className="app-card min-w-0">
      <SectionHeader
        icon={FolderOpen}
        title="Materiały PH"
        description={
          atRoot
            ? "Wybierz kategorię, np. Dokumentacja, Realizacje albo Umowy i papiery. Wszystko otwiera się wewnątrz CRM."
            : "Przeglądaj folder i otwieraj dokumenty, zdjęcia oraz materiały bez wychodzenia z CRM."
        }
        tone="leaf"
      />

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[#f8fafc] p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 text-xs font-bold text-muted">
          {crumbs.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex flex-none items-center gap-1">
              {index > 0 ? <span>/</span> : null}
              <button
                type="button"
                className={index === crumbs.length - 1 ? "text-ink" : "text-sky hover:underline"}
                onClick={() => void loadFolder(crumb.id, false)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {crumbs.length > 1 ? (
            <button
              type="button"
              className="btn-secondary min-h-10 px-3"
              onClick={() => void loadFolder(crumbs[crumbs.length - 2]?.id, false)}
            >
              <ArrowLeft className="h-4 w-4" />Wstecz
            </button>
          ) : null}
          <button
            type="button"
            className="btn-icon min-h-10 min-w-10"
            onClick={() => void loadFolder(current?.id, false)}
            aria-label="Odśwież materiały"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!loading ? (
        <div className="mb-3 text-xs font-bold text-muted">Foldery: {folders} · Pliki: {files}</div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-line bg-[#f4f6f8]" />
          ))}
        </div>
      ) : items.length ? (
        <div className={`grid gap-2.5 ${atRoot ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {items.map((item) => {
            const Icon = fileIcon(item);
            const folder = item.mimeType === FOLDER_MIME;
            const image = item.mimeType.startsWith("image/");
            return (
              <article
                key={item.id}
                className={`group min-w-0 rounded-xl border border-line bg-white p-3 shadow-sm transition hover:border-sky/30 hover:shadow-md ${atRoot && folder ? "min-h-28" : ""}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${folder ? "bg-solar/10 text-[#8a5a00]" : image ? "bg-leaf/10 text-leaf" : "bg-sky/10 text-sky"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-black leading-5 text-ink">{item.name}</h3>
                    {!folder ? (
                      <p className="mt-1 text-[11px] font-semibold text-muted">{prettySize(item.size) || "Materiał"}</p>
                    ) : (
                      <p className="mt-1 text-[11px] font-semibold text-muted">Kategoria / folder</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {folder ? (
                    <button
                      type="button"
                      onClick={() => void loadFolder(item.id, true)}
                      className="btn-secondary min-h-10 flex-1"
                    >
                      <Folder className="h-4 w-4" />Otwórz
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void openFile(item)}
                        className="btn-secondary min-h-10 flex-1"
                        disabled={previewLoading}
                      >
                        {item.mimeType.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        Otwórz
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadFile(item)}
                        className="btn-icon min-h-10 min-w-10"
                        aria-label={`Pobierz ${item.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Ten folder jest pusty" description="Wróć poziom wyżej i wybierz inną kategorię." />
      )}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative h-[94dvh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between gap-3 px-2 pr-12">
              <div className="truncate text-sm font-black text-ink">{previewName}</div>
              <button
                type="button"
                className="btn-icon absolute right-3 top-3 z-10 bg-white shadow"
                onClick={closePreview}
                aria-label="Zamknij podgląd"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(94dvh-4rem)] overflow-hidden rounded-xl bg-[#f5f7f9]">
              {previewMime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewName} className="h-full w-full object-contain" />
              ) : previewMime.startsWith("video/") ? (
                <video src={previewUrl} className="h-full w-full bg-black object-contain" controls autoPlay />
              ) : (
                <iframe title={previewName} src={previewUrl} className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

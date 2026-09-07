"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Download,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Images,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { Alert, EmptyState, SectionHeader } from "@/components/ui";
import { supabase } from "@/lib/supabase";

const ROOT_CATEGORIES = [
  { name: "Dokumentacja", description: "Dokumenty techniczne, karty, instrukcje i materiały dla handlowców.", icon: FileText },
  { name: "Realizacje", description: "Zdjęcia i wideo z wykonanych instalacji i montaży.", icon: Images },
  { name: "Umowy i papiery", description: "Wzory umów, zgody, formularze i pozostałe dokumenty sprzedażowe.", icon: BookOpen },
  { name: "Skrypty", description: "Skrypty rozmów, procedury sprzedaży i materiały szkoleniowe.", icon: FileText },
  { name: "Karty katalogowe i prezentacje", description: "Prezentacje produktowe i materiały producentów.", icon: FolderOpen }
] as const;

type AssetItem = {
  id: string | null;
  name: string;
  path: string;
  isFolder: boolean;
  mimeType: string | null;
  size: number | null;
  updatedAt: string | null;
};

type ListResponse = {
  bucket: string;
  path: string;
  items: AssetItem[];
  error?: string;
};

type Preview = {
  name: string;
  url: string;
  mimeType: string;
} | null;

function formatBytes(value: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fileIcon(item: AssetItem) {
  if (item.isFolder) return Folder;
  if (item.mimeType?.startsWith("image/")) return FileImage;
  if (item.mimeType?.startsWith("video/")) return Play;
  if (item.mimeType === "application/pdf") return FileText;
  return File;
}

function canPreview(mimeType: string | null) {
  return Boolean(
    mimeType &&
      (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf" || mimeType.startsWith("text/"))
  );
}

function folderOfRelativePath(relativePath: string) {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return "";
  return parts.slice(1, -1).join("/");
}

export function KnowledgeAssetsBrowser({
  accessToken,
  canEdit
}: {
  accessToken: string;
  canEdit: boolean;
}) {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [bucket, setBucket] = useState("knowledge-assets");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, current: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const load = useCallback(async (targetPath = path) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (targetPath) params.set("path", targetPath);
    const response = await fetch(`/api/knowledge/assets?${params}`, {
      headers: headers(),
      cache: "no-store"
    });
    const body = (await response.json().catch(() => ({}))) as ListResponse;
    if (!response.ok) {
      setError(body.error || "Nie udało się pobrać Skarbnicy wiedzy.");
      setLoading(false);
      return;
    }
    setBucket(body.bucket || "knowledge-assets");
    setItems(body.items || []);
    setPath(body.path || targetPath);
    setLoading(false);
  }, [headers, path]);

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const crumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return [
      { label: "Skarbnica", path: "" },
      ...parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join("/") }))
    ];
  }, [path]);

  const rootFolders = useMemo(() => {
    if (path) return [];
    const existingFolders = new Set(items.filter((item) => item.isFolder).map((item) => item.name));
    const fixed = ROOT_CATEGORIES.map((category) => ({
      ...category,
      exists: existingFolders.has(category.name)
    }));
    const extras = items
      .filter((item) => item.isFolder && !ROOT_CATEGORIES.some((category) => category.name === item.name))
      .map((item) => ({ name: item.name, description: "Folder materiałów", icon: Folder, exists: true }));
    return [...fixed, ...extras];
  }, [items, path]);

  async function getSignedUrl(item: AssetItem, download = false) {
    const params = new URLSearchParams({ file: item.path });
    if (download) params.set("download", "1");
    const response = await fetch(`/api/knowledge/assets?${params}`, {
      headers: headers(),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.url) throw new Error(body.error || "Nie udało się otworzyć pliku.");
    return String(body.url);
  }

  async function openFile(item: AssetItem) {
    setError("");
    try {
      const url = await getSignedUrl(item);
      if (canPreview(item.mimeType)) {
        setPreview({ name: item.name, url, mimeType: item.mimeType || "application/octet-stream" });
      } else {
        window.location.href = await getSignedUrl(item, true);
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Nie udało się otworzyć pliku.");
    }
  }

  async function downloadFile(item: AssetItem) {
    setError("");
    try {
      window.location.href = await getSignedUrl(item, true);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Nie udało się pobrać pliku.");
    }
  }

  async function removeFile(item: AssetItem) {
    if (!canEdit || item.isFolder || uploading) return;
    if (!window.confirm(`Usunąć plik „${item.name}”?`)) return;
    setError("");
    const response = await fetch("/api/knowledge/assets", {
      method: "DELETE",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Nie udało się usunąć pliku.");
      return;
    }
    setNotice("Plik został usunięty.");
    await load(path);
  }

  async function uploadFiles(files: File[], directoryUpload: boolean) {
    if (!canEdit || !files.length || uploading) return;
    setUploading(true);
    setError("");
    setNotice("");
    setUploadProgress({ done: 0, total: files.length, current: files[0]?.name || "" });

    let done = 0;
    try {
      for (const file of files) {
        setUploadProgress({ done, total: files.length, current: file.name });
        const relativeFolder = directoryUpload ? folderOfRelativePath(file.webkitRelativePath || file.name) : "";
        const tokenResponse = await fetch("/api/knowledge/assets", {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_upload",
            folderPath: path,
            relativeFolder,
            fileName: file.name
          })
        });
        const tokenBody = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok || !tokenBody.token || !tokenBody.path) {
          throw new Error(tokenBody.error || `Nie udało się przygotować wysyłki: ${file.name}`);
        }

        const { error: uploadError } = await supabase.storage
          .from(tokenBody.bucket || bucket)
          .uploadToSignedUrl(tokenBody.path, tokenBody.token, file);
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);
        done += 1;
        setUploadProgress({ done, total: files.length, current: file.name });
      }
      setNotice(`Wgrano ${done} plików do Skarbnicy.`);
      await load(path);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nie udało się wgrać materiałów.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>, directoryUpload: boolean) {
    const files = Array.from(event.target.files || []);
    void uploadFiles(files, directoryUpload);
  }

  function goUp() {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    void load(parts.join("/"));
  }

  return (
    <section className="app-card min-w-0 overflow-hidden">
      <SectionHeader
        icon={FolderOpen}
        title="Materiały PH"
        description="Pliki są zapisane bezpośrednio w CRM. Brak połączenia z Google Drive."
        tone="leaf"
      />

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}

      <div className="mb-4 flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-[#f8fafc] p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 text-xs font-bold text-muted">
          {crumbs.map((crumb, index) => (
            <span key={crumb.path || "root"} className="inline-flex flex-none items-center gap-1">
              {index > 0 ? <span>/</span> : null}
              <button
                type="button"
                onClick={() => void load(crumb.path)}
                className={index === crumbs.length - 1 ? "text-ink" : "text-sky hover:underline"}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {path ? (
            <button type="button" className="btn-secondary min-h-10 px-3" onClick={goUp}>
              <ArrowLeft className="h-4 w-4" />Wstecz
            </button>
          ) : null}
          <button type="button" className="btn-icon min-h-10 min-w-10" onClick={() => void load(path)} aria-label="Odśwież">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canEdit ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => chooseFiles(event, false)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                onChange={(event) => chooseFiles(event, true)}
              />
              <button type="button" className="btn-secondary min-h-10" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4" />Pliki
              </button>
              <button type="button" className="btn-primary min-h-10" onClick={() => folderInputRef.current?.click()} disabled={uploading}>
                <Folder className="h-4 w-4" />Cały folder
              </button>
            </>
          ) : null}
        </div>
      </div>

      {uploading ? (
        <div className="mb-4 rounded-xl border border-sky/20 bg-sky/5 p-3">
          <div className="flex items-center gap-2 text-sm font-black text-ink">
            <LoaderCircle className="h-4 w-4 animate-spin text-sky" />
            Wgrywanie {uploadProgress.done}/{uploadProgress.total}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-muted">{uploadProgress.current}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-sky transition-all"
              style={{ width: `${uploadProgress.total ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {!path ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rootFolders.map((folder) => {
            const Icon = folder.icon;
            return (
              <button
                key={folder.name}
                type="button"
                onClick={() => void load(folder.name)}
                className="group min-h-32 rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky/30 hover:shadow-md active:translate-y-0"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-solar/10 text-[#8a5a00]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="mt-3 font-black text-ink">{folder.name}</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-muted">{folder.description}</div>
              </button>
            );
          })}
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-line bg-[#f4f6f8]" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = fileIcon(item);
            return (
              <article key={item.path} className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-sm transition hover:border-sky/30 hover:shadow-md">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${item.isFolder ? "bg-solar/10 text-[#8a5a00]" : item.mimeType?.startsWith("image/") ? "bg-leaf/10 text-leaf" : "bg-sky/10 text-sky"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-black leading-5 text-ink">{item.name}</h3>
                    <p className="mt-1 text-[11px] font-semibold text-muted">{item.isFolder ? "Folder" : formatBytes(item.size) || "Plik"}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {item.isFolder ? (
                    <button type="button" onClick={() => void load(item.path)} className="btn-secondary min-h-10 flex-1">
                      <FolderOpen className="h-4 w-4" />Otwórz
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => void openFile(item)} className="btn-secondary min-h-10 flex-1">
                        {canPreview(item.mimeType) ? "Otwórz" : "Pobierz"}
                      </button>
                      <button type="button" onClick={() => void downloadFile(item)} className="btn-icon min-h-10 min-w-10" aria-label={`Pobierz ${item.name}`}>
                        <Download className="h-4 w-4" />
                      </button>
                      {canEdit ? (
                        <button type="button" onClick={() => void removeFile(item)} className="btn-icon min-h-10 min-w-10 text-danger" aria-label={`Usuń ${item.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Ten folder jest pusty"
          description={canEdit ? "Wgraj pliki albo cały folder przyciskiem u góry." : "Materiały nie zostały jeszcze wgrane."}
        />
      )}

      {preview ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative h-[94dvh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-12 items-center justify-between gap-3 px-2 pr-12">
              <div className="truncate text-sm font-black text-ink">{preview.name}</div>
              <button type="button" className="btn-icon absolute right-3 top-3 z-10 bg-white shadow" onClick={() => setPreview(null)} aria-label="Zamknij podgląd">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(94dvh-4rem)] overflow-hidden rounded-xl bg-[#f5f7f9]">
              {preview.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="h-full w-full object-contain" />
              ) : preview.mimeType.startsWith("video/") ? (
                <video src={preview.url} className="h-full w-full bg-black object-contain" controls autoPlay />
              ) : (
                <iframe title={preview.name} src={preview.url} className="h-full w-full border-0" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

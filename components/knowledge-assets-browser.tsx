"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, File, FileImage, FileText, Folder, Images, LoaderCircle, Play, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Alert, EmptyState } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type AssetItem = { id: string | null; name: string; path: string; isFolder: boolean; mimeType: string | null; size: number | null; updatedAt: string | null; previewUrl?: string | null };
type ListResponse = { bucket: string; path: string; items: AssetItem[]; error?: string };
type Preview = { name: string; url: string; mimeType: string } | null;

const ROOTS = [
  { name: "Galeria", description: "Realizacje i zdjęcia: magazyny, falowniki, panele, turbiny i pozostałe montaże.", icon: Images },
  { name: "Papiery", description: "Umowy, formularze, dokumentacja, skrypty, karty katalogowe i prezentacje.", icon: FileText }
] as const;

function formatBytes(value: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
function fileIcon(item: AssetItem) {
  if (item.isFolder) return Folder;
  if (item.mimeType?.startsWith("image/")) return FileImage;
  if (item.mimeType?.startsWith("video/")) return Play;
  if (item.mimeType === "application/pdf") return FileText;
  return File;
}
function canPreview(mimeType: string | null) {
  return Boolean(mimeType && (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf" || mimeType.startsWith("text/")));
}
function folderOfRelativePath(relativePath: string) {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return "";
  return parts.slice(1, -1).join("/");
}

export function KnowledgeAssetsBrowser({ accessToken, canEdit }: { accessToken: string; canEdit: boolean }) {
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
  const headers = useCallback(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  const load = useCallback(async (targetPath = "") => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (targetPath) params.set("path", targetPath);
    const response = await fetch(`/api/knowledge/assets?${params}`, { headers: headers(), cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as ListResponse;
    if (!response.ok) { setError(body.error || "Nie udało się pobrać Skarbnicy wiedzy."); setLoading(false); return; }
    setBucket(body.bucket || "knowledge-assets"); setItems(body.items || []); setPath(body.path || targetPath); setLoading(false);
  }, [headers]);

  useEffect(() => { void load(""); }, [load]);

  const crumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return [{ label: "Skarbnica", path: "" }, ...parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join("/") }))];
  }, [path]);
  const galleryMode = path === "Galeria" || path.startsWith("Galeria/");
  const folders = items.filter((item) => item.isFolder);
  const files = items.filter((item) => !item.isFolder);

  async function signedUrl(item: AssetItem, download = false) {
    if (!download && item.previewUrl) return item.previewUrl;
    const params = new URLSearchParams({ file: item.path });
    if (download) params.set("download", "1");
    const response = await fetch(`/api/knowledge/assets?${params}`, { headers: headers(), cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.url) throw new Error(body.error || "Nie udało się otworzyć pliku.");
    return String(body.url);
  }
  async function openFile(item: AssetItem) {
    setError("");
    try {
      const url = await signedUrl(item);
      if (canPreview(item.mimeType)) setPreview({ name: item.name, url, mimeType: item.mimeType || "application/octet-stream" });
      else window.location.href = await signedUrl(item, true);
    } catch (openError) { setError(openError instanceof Error ? openError.message : "Nie udało się otworzyć pliku."); }
  }
  async function downloadFile(item: AssetItem) {
    try { window.location.href = await signedUrl(item, true); }
    catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : "Nie udało się pobrać pliku."); }
  }
  async function removeFile(item: AssetItem) {
    if (!canEdit || item.isFolder || uploading) return;
    if (!window.confirm(`Usunąć plik „${item.name}”?`)) return;
    const response = await fetch("/api/knowledge/assets", { method: "DELETE", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ path: item.path }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setError(body.error || "Nie udało się usunąć pliku.");
    setNotice("Plik usunięty."); await load(path);
  }
  async function uploadFiles(selected: File[], directoryUpload: boolean) {
    if (!canEdit || !selected.length || uploading) return;
    setUploading(true); setError(""); setNotice(""); setUploadProgress({ done: 0, total: selected.length, current: selected[0]?.name || "" });
    let done = 0;
    try {
      for (const file of selected) {
        setUploadProgress({ done, total: selected.length, current: file.name });
        const relativeFolder = directoryUpload ? folderOfRelativePath(file.webkitRelativePath || file.name) : "";
        const response = await fetch("/api/knowledge/assets", { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_upload", folderPath: path, relativeFolder, fileName: file.name }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.token || !body.path) throw new Error(body.error || `Nie udało się przygotować: ${file.name}`);
        const { error: uploadError } = await supabase.storage.from(body.bucket || bucket).uploadToSignedUrl(body.path, body.token, file);
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);
        done += 1; setUploadProgress({ done, total: selected.length, current: file.name });
      }
      setNotice(`Wgrano ${done} plików.`); await load(path);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Nie udało się wgrać materiałów."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; if (folderInputRef.current) folderInputRef.current.value = ""; }
  }
  function goUp() { const parts = path.split("/").filter(Boolean); parts.pop(); void load(parts.join("/")); }

  const uploadControls = canEdit ? (
    <>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void uploadFiles(Array.from(event.target.files || []), false)} />
      <input ref={folderInputRef} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => void uploadFiles(Array.from(event.target.files || []), true)} />
      <button type="button" className="btn-secondary min-h-10" onClick={() => fileInputRef.current?.click()} disabled={uploading}><Upload className="h-4 w-4" />Dodaj pliki</button>
      <button type="button" className="btn-primary min-h-10" onClick={() => folderInputRef.current?.click()} disabled={uploading}><Folder className="h-4 w-4" />Dodaj folder</button>
    </>
  ) : null;

  return (
    <section className="min-w-0">
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}

      {path ? (
        <div className="mb-4 flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1 text-xs font-bold text-muted">
            {crumbs.map((crumb, index) => <span key={crumb.path || "root"} className="inline-flex flex-none items-center gap-1">{index ? <span>/</span> : null}<button type="button" onClick={() => void load(crumb.path)} className={index === crumbs.length - 1 ? "text-ink" : "text-sky hover:underline"}>{crumb.label}</button></span>)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn-secondary min-h-10 px-3" onClick={goUp}><ArrowLeft className="h-4 w-4" />Wstecz</button>
            <button type="button" className="btn-icon min-h-10 min-w-10" onClick={() => void load(path)} aria-label="Odśwież"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
            {uploadControls}
          </div>
        </div>
      ) : canEdit ? <div className="mb-4 flex flex-wrap justify-end gap-2">{uploadControls}</div> : null}

      {uploading ? <div className="mb-4 rounded-2xl border border-sky/20 bg-sky/5 p-3"><div className="flex items-center gap-2 text-sm font-black"><LoaderCircle className="h-4 w-4 animate-spin text-sky" />Wgrywanie {uploadProgress.done}/{uploadProgress.total}</div><div className="mt-1 truncate text-xs font-semibold text-muted">{uploadProgress.current}</div></div> : null}

      {!path ? (
        <div className="grid gap-4 md:grid-cols-2">
          {ROOTS.map(({ name, description, icon: Icon }) => <button key={name} type="button" onClick={() => void load(name)} className="group min-h-48 rounded-3xl border border-line bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky/30 hover:shadow-lg"><span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f5f8] text-ink"><Icon className="h-7 w-7" /></span><div className="mt-5 text-xl font-black tracking-tight text-ink">{name}</div><p className="mt-2 max-w-md text-sm font-semibold leading-6 text-muted">{description}</p></button>)}
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-white" />)}</div>
      ) : <>
        {folders.length ? <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{folders.map((folder) => <button key={folder.path} type="button" onClick={() => void load(folder.path)} className="group rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-sky/30 hover:shadow-md"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-solar/10 text-[#8a5a00]"><Folder className="h-5 w-5" /></span><div className="mt-3 break-words font-black text-ink">{folder.name}</div><div className="mt-1 text-xs font-semibold text-muted">Otwórz folder</div></button>)}</div> : null}

        {files.length ? galleryMode ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {files.map((item) => {
              const image = item.mimeType?.startsWith("image/"); const video = item.mimeType?.startsWith("video/");
              return <article key={item.path} className="group min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><button type="button" onClick={() => void openFile(item)} className="block aspect-[4/3] w-full overflow-hidden bg-[#eef2f5] text-left">{image && item.previewUrl ? <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" /> : video ? <span className="flex h-full items-center justify-center"><Play className="h-10 w-10 text-ink" /></span> : <span className="flex h-full items-center justify-center"><FileText className="h-10 w-10 text-muted" /></span>}</button><div className="p-2.5"><button type="button" onClick={() => void openFile(item)} className="block w-full truncate text-left text-xs font-black text-ink" title={item.name}>{item.name}</button><div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted"><span>{formatBytes(item.size)}</span><div className="flex gap-1"><button type="button" className="btn-icon h-8 min-h-8 w-8 min-w-8" onClick={() => void downloadFile(item)} aria-label={`Pobierz ${item.name}`}><Download className="h-3.5 w-3.5" /></button>{canEdit ? <button type="button" className="btn-icon h-8 min-h-8 w-8 min-w-8 text-danger" onClick={() => void removeFile(item)} aria-label={`Usuń ${item.name}`}><Trash2 className="h-3.5 w-3.5" /></button> : null}</div></div></div></article>;
            })}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{files.map((item) => { const Icon = fileIcon(item); return <article key={item.path} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm"><button type="button" onClick={() => void openFile(item)} className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-sky/10 text-sky"><Icon className="h-5 w-5" /></button><button type="button" onClick={() => void openFile(item)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-black text-ink">{item.name}</span><span className="mt-1 block text-[11px] font-semibold text-muted">{formatBytes(item.size) || "Plik"}</span></button><button type="button" className="btn-icon h-9 min-h-9 w-9 min-w-9" onClick={() => void downloadFile(item)} aria-label={`Pobierz ${item.name}`}><Download className="h-4 w-4" /></button>{canEdit ? <button type="button" className="btn-icon h-9 min-h-9 w-9 min-w-9 text-danger" onClick={() => void removeFile(item)} aria-label={`Usuń ${item.name}`}><Trash2 className="h-4 w-4" /></button> : null}</article>; })}</div>
        ) : null}
        {!folders.length && !files.length ? <EmptyState title="Ten folder jest pusty" description={canEdit ? "Dodaj pliki lub foldery przyciskami powyżej." : "Brak materiałów w tej kategorii."} /> : null}
      </>}

      {preview ? <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm" onClick={() => setPreview(null)}><div className="relative h-[94dvh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex h-12 items-center pr-12"><div className="truncate px-2 text-sm font-black">{preview.name}</div><button type="button" className="btn-icon absolute right-3 top-3 z-10 bg-white shadow" onClick={() => setPreview(null)} aria-label="Zamknij"><X className="h-5 w-5" /></button></div><div className="h-[calc(94dvh-4rem)] overflow-hidden rounded-xl bg-[#f3f5f7]">{preview.mimeType.startsWith("image/") ? <img src={preview.url} alt={preview.name} className="h-full w-full object-contain" /> : preview.mimeType.startsWith("video/") ? <video src={preview.url} className="h-full w-full bg-black object-contain" controls autoPlay /> : <iframe title={preview.name} src={preview.url} className="h-full w-full border-0" />}</div></div></div> : null}
    </section>
  );
}

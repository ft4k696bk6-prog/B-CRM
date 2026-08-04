"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Images, Upload, X } from "lucide-react";
import { Alert } from "@/components/ui";
import type { ContractRecord } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";

type ContractFile = NonNullable<ContractRecord["files"]>[number];
type Mode = "viewer" | "manage";

export function ContractAttachments({
  contract,
  accessToken,
  mode,
  onUploaded
}: {
  contract: ContractRecord;
  accessToken: string;
  mode: Mode;
  onUploaded?: (files: ContractFile[]) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});
  const [uploading, setUploading] = useState("");
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"contract" | "gallery" | null>(null);
  const [focused, setFocused] = useState<ContractFile | null>(null);

  const files = useMemo(() => contract.files || [], [contract.files]);
  const contractPdf = files.find((file) => file.kind === "contract_pdf");
  const gallery = useMemo(() => files.filter((file) => file.kind === "photo" || file.kind === "video"), [files]);

  useEffect(() => {
    let active = true;
    const missing = files.filter((file) => file.path && !urls[file.id]);
    if (!missing.length) return;
    Promise.all(missing.map(async (file) => {
      const response = await fetch(`/api/contracts/files?path=${encodeURIComponent(file.path)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json();
      return response.ok ? [file.id, body.url] as const : null;
    })).then((entries) => {
      if (!active) return;
      setUrls((current) => ({ ...current, ...Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>) }));
    });
    return () => { active = false; };
  }, [accessToken, files, urls]);

  async function download(file: ContractFile) {
    const url = urls[file.id];
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function downloadAll() {
    for (const file of files) await download(file);
  }

  async function upload(kind: string) {
    const chosen = selectedFiles[kind] || [];
    if (!chosen.length) return;
    setUploading(kind); setProgress(`0 / ${chosen.length}`); setError(""); setMessage("");
    const uploaded: ContractFile[] = []; const failed: string[] = []; let cursor = 0; let completed = 0;
    async function uploadOne(file: File) {
      const metadata = { lead_id: contract.lead_id, contract_id: contract.id, kind, file_name: file.name, mime: file.type || "application/octet-stream", size: file.size };
      try {
        const prepareResponse = await fetch("/api/contracts/files", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: "prepare", ...metadata }) });
        const prepared = await prepareResponse.json();
        if (!prepareResponse.ok) throw new Error(prepared.error || "Nie udało się przygotować przesyłania.");
        const { error: uploadError } = await supabase.storage.from("contract-files").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: metadata.mime });
        if (uploadError) throw uploadError;
        const finalizeResponse = await fetch("/api/contracts/files", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: "finalize", path: prepared.path, ...metadata }) });
        const finalized = await finalizeResponse.json();
        if (!finalizeResponse.ok) throw new Error(finalized.error || "Nie udało się zapisać załącznika.");
        uploaded.push(finalized.file);
      } catch (uploadError) {
        failed.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : "błąd przesyłania"}`);
      } finally {
        completed += 1; setProgress(`${completed} / ${chosen.length}`);
      }
    }
    async function worker() { while (cursor < chosen.length) { const index = cursor++; await uploadOne(chosen[index]); } }
    try {
      await Promise.all(Array.from({ length: Math.min(3, chosen.length) }, () => worker()));
      if (uploaded.length) {
        onUploaded?.(uploaded);
        setMessage(`Przesłano i zapisano ${uploaded.length} ${uploaded.length === 1 ? "plik" : uploaded.length < 5 ? "pliki" : "plików"}.`);
      }
      const failedNames = new Set(failed.map((item) => item.split(":")[0]));
      setSelectedFiles((current) => ({ ...current, [kind]: chosen.filter((file) => failedNames.has(file.name)) }));
      if (failed.length) setError(`Nie udało się przesłać ${failed.length} plików. ${failed.join(" | ")}`);
    } finally { setUploading(""); setProgress(""); }
  }

  if (mode === "manage") return (
    <div className="grid gap-4">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {[["contract_pdf", "PDF umowy (25 MB)", "application/pdf"], ["photo", "Zdjęcia (15 MB każde)", "image/*"], ["video", "Wideo (50 MB)", "video/*"]].map(([kind, label, accept]) => (
          <div key={kind} className="rounded-lg border border-line p-3">
            <label><span className="label">{label}</span><input className="field" type="file" accept={accept} multiple={kind === "photo"} onChange={(event) => setSelectedFiles((current) => ({ ...current, [kind]: Array.from(event.target.files || []) }))} /></label>
            <button type="button" className="btn-primary mt-3 w-full" disabled={!selectedFiles[kind]?.length || Boolean(uploading)} onClick={() => upload(kind)}><Upload className="h-4 w-4" />{uploading === kind ? `Przesyłanie ${progress}` : selectedFiles[kind]?.length > 1 ? `Prześlij ${selectedFiles[kind].length} plików` : "Prześlij plik"}</button>
          </div>
        ))}
      </div>
      <div className="text-sm font-bold text-muted">Zapisane załączniki: {files.length}</div>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={!contractPdf} onClick={() => setModal("contract")}><FileText className="h-4 w-4" />Podgląd umowy</button>
        <button type="button" className="btn-secondary" disabled={!gallery.length} onClick={() => setModal("gallery")}><Images className="h-4 w-4" />Galeria ({gallery.length})</button>
        <button type="button" className="btn-secondary" disabled={!files.length} onClick={downloadAll}><Download className="h-4 w-4" />Pobierz wszystkie</button>
      </div>
      {modal ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => { setModal(null); setFocused(null); }}>
        <div className="relative max-h-[94vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn-icon absolute right-3 top-3 z-10 bg-white" onClick={() => { setModal(null); setFocused(null); }} aria-label="Zamknij"><X className="h-5 w-5" /></button>
          {modal === "contract" && contractPdf ? <div className="grid gap-3"><iframe title="Podgląd umowy" className="h-[82vh] w-full rounded-lg border border-line" src={urls[contractPdf.id]} /><button type="button" className="btn-primary justify-self-start" onClick={() => download(contractPdf)}><Download className="h-4 w-4" />Pobierz PDF</button></div> : null}
          {modal === "gallery" ? <div className="grid gap-4 pt-10 sm:grid-cols-2 lg:grid-cols-3">{gallery.map((file) => <div key={file.id} className="overflow-hidden rounded-lg border border-line bg-[#f8fafc]">{file.kind === "photo" ? <button type="button" className="block h-56 w-full" onClick={() => setFocused(file)}><img src={urls[file.id]} alt={file.name} className="h-full w-full object-cover" /></button> : <video className="h-56 w-full bg-black object-contain" src={urls[file.id]} controls preload="metadata" />}<div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-sm font-bold">{file.name}</span><button type="button" className="btn-icon" onClick={() => download(file)} title="Pobierz"><Download className="h-4 w-4" /></button></div></div>)}</div> : null}
        </div>
      </div> : null}
      {focused ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onClick={() => setFocused(null)}><img src={urls[focused.id]} alt={focused.name} className="max-h-full max-w-full rounded-lg object-contain" /></div> : null}
    </>
  );
}

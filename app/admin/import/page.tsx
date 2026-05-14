"use client";

import { ChangeEvent, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, FileUp, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

type CsvLead = {
  full_name?: string;
  phone?: string;
  postal_code?: string;
  source?: string;
  address?: string;
  voivodeship?: string;
  county?: string;
};

const requiredColumns = ["full_name", "phone", "postal_code", "source"];

export default function ImportPage() {
  const { loading, profile } = useAuth("admin");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvLead[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setSuccess("");
    setRows([]);

    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<CsvLead>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, ""),
      complete: (result) => {
        const fields = result.meta.fields || [];
        const missing = requiredColumns.filter((column) => !fields.includes(column));

        if (missing.length > 0) {
          setError(`Brak wymaganych kolumn: ${missing.join(", ")}`);
          return;
        }

        const cleaned = result.data
          .map((row) => ({
            full_name: row.full_name?.trim(),
            phone: row.phone?.trim(),
            postal_code: row.postal_code?.trim(),
            source: row.source?.trim(),
            address: row.address?.trim() || null,
            voivodeship: row.voivodeship?.trim() || null,
            county: row.county?.trim() || null
          }))
          .filter((row) => row.full_name && row.phone && row.postal_code && row.source);

        if (cleaned.length === 0) {
          setError("Plik nie zawiera poprawnych leadów.");
          return;
        }

        setRows(cleaned as CsvLead[]);
      },
      error: () => setError("Nie udało się odczytać pliku CSV.")
    });
  }

  async function importRows() {
    if (rows.length === 0) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const payload = rows.map((row) => ({
      full_name: row.full_name,
      phone: row.phone,
      postal_code: row.postal_code,
      source: row.source,
      address: row.address || null,
      voivodeship: row.voivodeship || null,
      county: row.county || null,
      status: "Nowy",
      assigned_to: null
    }));

    const { error: importError } = await supabase.from("leads").insert(payload);

    if (importError) {
      setError(importError.message);
    } else {
      setSuccess(`Zaimportowano leady: ${rows.length}`);
      setRows([]);
      setFileName("");
    }

    setBusy(false);
  }

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div>
          <h1 className="section-title">Import CSV</h1>
          <p className="mt-1 text-sm text-muted">Kolumny: full_name, phone, postal_code, source.</p>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[#f9fbfd] px-4 py-10 text-center transition hover:border-sky hover:bg-sky/5">
            <UploadCloud className="h-9 w-9 text-sky" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-ink">
              {fileName || "Wybierz plik CSV"}
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
          </label>

          {error ? (
            <div className="mt-4 flex gap-3 rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 flex gap-3 rounded-md border border-leaf/20 bg-leaf/10 p-3 text-sm text-leaf">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>{success}</span>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="mt-5 grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-ink">Gotowe do importu: {rows.length}</div>
                <button type="button" onClick={importRows} disabled={busy} className="btn-primary">
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Importuj
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-line bg-[#f9fbfd] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3">Imię i nazwisko</th>
                        <th className="px-4 py-3">Telefon</th>
                        <th className="px-4 py-3">Kod</th>
                        <th className="px-4 py-3">Źródło</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.slice(0, 20).map((row, index) => (
                        <tr key={`${row.phone}-${index}`}>
                          <td className="px-4 py-3 font-semibold">{row.full_name}</td>
                          <td className="px-4 py-3">{row.phone}</td>
                          <td className="px-4 py-3">{row.postal_code}</td>
                          <td className="px-4 py-3">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

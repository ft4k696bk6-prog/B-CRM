"use client";

import { ChangeEvent, useState } from "react";
import Papa from "papaparse";
import { FileUp, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader } from "@/components/ui";
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
  const { loading, profile } = useAuth(["owner", "admin", "menadzer"]);
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
        <PageHeader
          title="Import CSV"
          description="Wymagane kolumny: full_name, phone, postal_code, source."
        />

        <section className="app-card">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[#f9fbfd] px-4 py-10 text-center transition hover:border-sky hover:bg-sky/5">
            <UploadCloud className="h-9 w-9 text-sky" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-ink">
              {fileName || "Wybierz plik CSV"}
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
          </label>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}

          {success ? (
            <Alert tone="success" className="mt-4">
              {success}
            </Alert>
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
              <div className="hidden overflow-hidden rounded-lg border border-line md:block">
                <div className="max-h-80 overflow-auto">
                  <table className="app-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Imię i nazwisko</th>
                        <th>Telefon</th>
                        <th>Kod</th>
                        <th>Źródło</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((row, index) => (
                        <tr key={`${row.phone}-${index}`}>
                          <td className="font-semibold">{row.full_name}</td>
                          <td>{row.phone}</td>
                          <td>{row.postal_code}</td>
                          <td>{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 md:hidden">
                {rows.slice(0, 20).map((row, index) => (
                  <article key={`${row.phone}-${index}`} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                    <div className="font-bold text-ink">{row.full_name}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Telefon</span>
                        <p className="mt-1 font-semibold text-ink">{row.phone}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Kod</span>
                        <p className="mt-1 font-semibold text-ink">{row.postal_code}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Źródło</span>
                        <p className="mt-1 font-semibold text-ink">{row.source}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

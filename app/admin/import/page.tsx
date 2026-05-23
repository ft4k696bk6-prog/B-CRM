"use client";

import { ChangeEvent, useState } from "react";
import Papa from "papaparse";
import { FileUp, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

type CsvLead = Record<string, string | null | undefined>;

function displayCell(row: CsvLead, keys: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value] as const);
  const match = entries.find(([key]) => keys.includes(key));
  return match?.[1]?.trim() || "";
}

const nameColumns = ["full_name", "name", "klient", "imię i nazwisko", "imie i nazwisko", "imie i naziwsko"];
const phoneColumns = ["phone", "phone_number", "telefon", "tel", "numer telefonu", "telefon klienta"];
const postalColumns = ["postal_code", "post_code", "kod", "kod pocztowy"];
const sourceColumns = ["source", "źródło", "zrodlo", "kampania", "formularz"];
const importChunkSize = 800;

export default function ImportPage() {
  const { loading, profile } = useAuth(["owner", "admin", "kierownik"]);
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
        const cleaned = result.data
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value])
            )
          )
          .filter((row) => Object.values(row).some((value) => Boolean(value)));

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
    if (rows.length === 0 || !profile) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setError("Sesja wygasła. Zaloguj się ponownie.");
      setBusy(false);
      return;
    }

    let imported = 0;
    let skippedExisting = 0;
    let skippedInFile = 0;
    let failed = 0;
    let importError = "";

    for (let index = 0; index < rows.length; index += importChunkSize) {
      const chunk = rows.slice(index, index + importChunkSize);
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rows: chunk,
          source: "Import CSV",
          fileName: rows.length > importChunkSize ? `${fileName} (${index + 1}-${index + chunk.length})` : fileName
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        importError = result.error || "Nie udało się zaimportować leadów.";
        break;
      }

      imported += result.imported || 0;
      skippedExisting += result.skippedExisting || 0;
      skippedInFile += result.skippedInFile || 0;
      failed += result.failed || 0;
      setSuccess(`Import trwa. Przetworzono ${Math.min(index + chunk.length, rows.length)} z ${rows.length} wierszy.`);
    }

    if (importError) {
      setError(importError);
    } else {
      setSuccess(
        `Import zakończony. Dodano: ${imported}, pominięto duplikaty: ${
          skippedExisting + skippedInFile
        }, błędne wiersze: ${failed}.`
      );
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
          title="Import leadów"
          description="CSV z Dysku Google albo lokalny plik. CRM rozpoznaje kolumny typu telefon, e-mail, komentarz, data zgłoszenia, status i odkłada starsze rekordy do Zimnej bazy."
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
                          <td className="font-semibold">{displayCell(row, nameColumns)}</td>
                          <td>{displayCell(row, phoneColumns)}</td>
                          <td>{displayCell(row, postalColumns)}</td>
                          <td>{displayCell(row, sourceColumns)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 md:hidden">
                {rows.slice(0, 20).map((row, index) => (
                  <article key={`${row.phone}-${index}`} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                    <div className="font-bold text-ink">{displayCell(row, nameColumns) || "Lead"}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Telefon</span>
                        <p className="mt-1 font-semibold text-ink">{displayCell(row, phoneColumns)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Kod</span>
                        <p className="mt-1 font-semibold text-ink">{displayCell(row, postalColumns)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Źródło</span>
                        <p className="mt-1 font-semibold text-ink">{displayCell(row, sourceColumns) || "Import CSV"}</p>
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

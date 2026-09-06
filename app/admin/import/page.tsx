"use client";

import { ChangeEvent, useState } from "react";
import Papa from "papaparse";
import { FileUp, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Alert, PageHeader } from "@/components/ui";
import { normalizePhoneE164 } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

type CsvLead = {
  full_name?: string;
  phone?: string;
  postal_code?: string;
  source?: string;
  address?: string | null;
  voivodeship?: string | null;
  county?: string | null;
};

const requiredColumns = ["full_name", "phone", "postal_code", "source"];

export default function ImportPage() {
  const { loading, profile } = useAuth(["owner", "admin", "menadzer"]);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvLead[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [fileDuplicates, setFileDuplicates] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setSuccess("");
    setRows([]);
    setInvalidRows(0);
    setFileDuplicates(0);

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

        const valid: CsvLead[] = [];
        const seenPhones = new Set<string>();
        let invalid = 0;
        let duplicates = 0;

        for (const row of result.data) {
          const fullName = row.full_name?.trim();
          const phone = normalizePhoneE164(row.phone);
          const postalCode = row.postal_code?.trim();
          const source = row.source?.trim();

          if (!fullName || !phone || !postalCode || !source) {
            invalid += 1;
            continue;
          }

          if (seenPhones.has(phone)) {
            duplicates += 1;
            continue;
          }
          seenPhones.add(phone);

          valid.push({
            full_name: fullName,
            phone,
            postal_code: postalCode,
            source,
            address: row.address?.trim() || null,
            voivodeship: row.voivodeship?.trim() || null,
            county: row.county?.trim() || null
          });
        }

        setInvalidRows(invalid);
        setFileDuplicates(duplicates);

        if (valid.length === 0) {
          setError("Plik nie zawiera poprawnych, unikalnych leadów. Sprawdź wymagane pola i numery telefonu.");
          return;
        }

        setRows(valid);
      },
      error: () => setError("Nie udało się odczytać pliku CSV.")
    });
  }

  async function importRows() {
    if (rows.length === 0 || !profile) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const phones = rows.map((row) => row.phone).filter((phone): phone is string => Boolean(phone));
    const existingPhones = new Set<string>();

    for (let index = 0; index < phones.length; index += 200) {
      const chunk = phones.slice(index, index + 200);
      const { data, error: lookupError } = await supabase
        .from("leads")
        .select("phone")
        .eq("crm_environment", profile.crm_environment)
        .in("phone", chunk);

      if (lookupError) {
        setError(`Nie udało się sprawdzić duplikatów: ${lookupError.message}`);
        setBusy(false);
        return;
      }

      for (const item of data || []) {
        if (item.phone) existingPhones.add(item.phone);
      }
    }

    const rowsToInsert = rows.filter((row) => row.phone && !existingPhones.has(row.phone));
    const existingDuplicateCount = rows.length - rowsToInsert.length;

    if (rowsToInsert.length === 0) {
      setSuccess(`Nie dodano nowych leadów. Wszystkie ${rows.length} rekordów już istnieją w CRM.`);
      setRows([]);
      setBusy(false);
      return;
    }

    const payload = rowsToInsert.map((row) => ({
      full_name: row.full_name,
      phone: row.phone,
      postal_code: row.postal_code,
      source: row.source,
      address: row.address || null,
      voivodeship: row.voivodeship || null,
      county: row.county || null,
      status: "Nowy",
      assigned_to: null,
      crm_environment: profile.crm_environment
    }));

    const { error: importError } = await supabase.from("leads").insert(payload);

    if (importError) {
      setError(importError.message);
    } else {
      const skipped = invalidRows + fileDuplicates + existingDuplicateCount;
      setSuccess(
        `Dodano ${rowsToInsert.length} leadów${skipped ? `. Pominięto ${skipped}: błędne ${invalidRows}, duplikaty w pliku ${fileDuplicates}, już w CRM ${existingDuplicateCount}.` : "."}`
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
          title="Import CSV"
          description="Wymagane kolumny: full_name, phone, postal_code, source. Telefony są zapisywane w jednym formacie E.164."
        />

        <section className="app-card">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[#f9fbfd] px-4 py-10 text-center transition hover:border-sky hover:bg-sky/5">
            <UploadCloud className="h-9 w-9 text-sky" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-ink">
              {fileName || "Wybierz plik CSV"}
            </span>
            <span className="mt-1 text-xs text-muted">Polski numer może być 600123456; CRM zapisze go jako +48600123456.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
          </label>

          {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
          {success ? <Alert tone="success" className="mt-4">{success}</Alert> : null}

          {rows.length > 0 ? (
            <div className="mt-5 grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-ink">
                  Gotowe do sprawdzenia: {rows.length}
                  {invalidRows || fileDuplicates ? (
                    <span className="ml-2 text-muted">Pominięte przed importem: {invalidRows + fileDuplicates}</span>
                  ) : null}
                </div>
                <button type="button" onClick={importRows} disabled={busy} className="btn-primary">
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  {busy ? "Sprawdzanie…" : "Importuj"}
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
                          <td className="font-mono text-xs">{row.phone}</td>
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
                  <article key={`${row.phone}-${index}`} className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm">
                    <div className="break-words font-bold text-ink">{row.full_name}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Telefon</span>
                        <p className="mt-1 break-all font-mono text-xs font-semibold text-ink">{row.phone}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Kod</span>
                        <p className="mt-1 font-semibold text-ink">{row.postal_code}</p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">Źródło</span>
                        <p className="mt-1 break-words font-semibold text-ink">{row.source}</p>
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

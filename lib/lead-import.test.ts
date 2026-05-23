import { describe, expect, it } from "vitest";
import { mapLeadImportStatus, normalizeLeadImportBatch, normalizeLeadImportRow } from "@/lib/lead-import";

const now = new Date("2026-05-22T10:00:00.000Z");

describe("lead import normalization", () => {
  it("puts old rows without useful context into the cold base", () => {
    const row = normalizeLeadImportRow(
      {
        "Imię i nazwisko": "Jan Testowy",
        Telefon: "500 600 700",
        "Data zgłoszenia": "12.11.2024"
      },
      now
    );

    expect(row.ok && row.row.status).toBe("Zimna baza");
    expect(row.ok && row.row.created_at).toBeNull();
  });

  it("keeps fresh commented leads as new and preserves the current-year date", () => {
    const row = normalizeLeadImportRow(
      {
        klient: "Anna Testowa",
        telefon: "501 600 700",
        komentarz: "Prosi o kontakt po południu",
        data: "04.05.2026"
      },
      now
    );

    expect(row.ok && row.row.status).toBe("Nowy");
    expect(row.ok && row.row.created_at).toContain("2026");
  });

  it("recognizes common misspelled CRM export headers", () => {
    const row = normalizeLeadImportRow(
      {
        "Imie i naziwsko": "Marek Testowy",
        phone_number: "502 600 700",
        post_code: "20-115",
        lead_status: "po spotkaniu",
        created_time: "05.05.2026"
      },
      now
    );

    expect(row.ok && row.row.full_name).toBe("Marek Testowy");
    expect(row.ok && row.row.postal_code).toBe("20-115");
    expect(row.ok && row.row.status).toBe("Po spotkaniu");
  });

  it("maps meeting and callback context from comments", () => {
    expect(mapLeadImportStatus({ comment: "umówione spotkanie", now })).toBe("Spotkanie");
    expect(mapLeadImportStatus({ comment: "oddzwonić jutro", now })).toBe("Call back");
  });

  it("deduplicates within one uploaded batch by phone", () => {
    const batch = normalizeLeadImportBatch(
      [
        { full_name: "Pierwszy", phone: "+48 500 600 700" },
        { full_name: "Drugi", phone: "500600700" }
      ],
      now
    );

    expect(batch.valid).toHaveLength(1);
    expect(batch.duplicates).toHaveLength(1);
  });
});

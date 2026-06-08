import { afterEach, describe, expect, it } from "vitest";
import { metaLeadAdsSyncStatus, metaLeadgenToRawLead } from "@/lib/meta-lead-ads-sync";

const envKeys = [
  "META_LEAD_ADS_SYNC_ENABLED",
  "META_PAGE_ACCESS_TOKEN",
  "META_LEAD_ADS_ACCESS_TOKEN",
  "META_LEAD_ADS_FORM_IDS",
  "META_LEAD_ADS_PAGE_IDS",
  "META_PAGE_ID"
];

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function resetEnv() {
  envKeys.forEach((key) => {
    const original = originalEnv[key];
    if (original == null) delete process.env[key];
    else process.env[key] = original;
  });
}

describe("meta lead ads sync", () => {
  afterEach(resetEnv);

  it("auto-enables when a token and form ids are present", () => {
    envKeys.forEach((key) => delete process.env[key]);
    process.env.META_PAGE_ACCESS_TOKEN = "token";
    process.env.META_LEAD_ADS_FORM_IDS = "form-1, form-2";

    const status = metaLeadAdsSyncStatus();

    expect(status.enabled).toBe(true);
    expect(status.configured.formIds).toBe(2);
  });

  it("combines first and last name from Meta field data", () => {
    const raw = metaLeadgenToRawLead(
      {
        id: "lead-1",
        created_time: "2026-06-08T09:00:00+0000",
        field_data: [
          { name: "first_name", values: ["Anna"] },
          { name: "last_name", values: ["Testowa"] },
          { name: "phone_number", values: ["+48 500 600 700"] },
          { name: "email", values: ["anna@example.com"] }
        ],
        form_id: "form-1",
        page_id: "page-1"
      },
      {}
    );

    expect(raw.full_name).toBe("Anna Testowa");
    expect(raw.phone).toBe("+48 500 600 700");
    expect(raw.comment).toContain("leadgen_id=lead-1");
  });
});

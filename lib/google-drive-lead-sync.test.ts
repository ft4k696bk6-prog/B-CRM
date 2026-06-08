import { afterEach, describe, expect, it } from "vitest";
import { googleDriveLeadSyncStatus } from "@/lib/google-drive-lead-sync";

const envKeys = [
  "GOOGLE_DRIVE_LEAD_SYNC_ENABLED",
  "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_CLIENT_EMAIL",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_LEAD_FILE_IDS",
  "GOOGLE_DRIVE_LEAD_FOLDER_ID"
];

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function resetEnv() {
  envKeys.forEach((key) => {
    const original = originalEnv[key];
    if (original == null) delete process.env[key];
    else process.env[key] = original;
  });
}

describe("google drive lead sync status", () => {
  afterEach(resetEnv);

  it("stays disabled when no production credentials or lead targets are configured", () => {
    envKeys.forEach((key) => delete process.env[key]);

    const status = googleDriveLeadSyncStatus();

    expect(status.enabled).toBe(false);
    expect(status.missing).toContain("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON albo GOOGLE_DRIVE_CLIENT_EMAIL/GOOGLE_DRIVE_PRIVATE_KEY");
    expect(status.missing).toContain("GOOGLE_DRIVE_LEAD_FILE_IDS albo GOOGLE_DRIVE_LEAD_FOLDER_ID");
  });

  it("auto-enables when credentials and a target are present and the flag is unset", () => {
    envKeys.forEach((key) => delete process.env[key]);
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "sync@example.iam.gserviceaccount.com";
    process.env.GOOGLE_DRIVE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----";
    process.env.GOOGLE_DRIVE_LEAD_FILE_IDS = "file-1";

    const status = googleDriveLeadSyncStatus();

    expect(status.enabled).toBe(true);
    expect(status.configured.serviceAccount).toBe(true);
    expect(status.configured.fileIds).toBe(1);
  });

  it("respects an explicit false flag even with complete config", () => {
    envKeys.forEach((key) => delete process.env[key]);
    process.env.GOOGLE_DRIVE_LEAD_SYNC_ENABLED = "false";
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "sync@example.iam.gserviceaccount.com";
    process.env.GOOGLE_DRIVE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----";
    process.env.GOOGLE_DRIVE_LEAD_FOLDER_ID = "folder-1";

    expect(googleDriveLeadSyncStatus().enabled).toBe(false);
  });
});

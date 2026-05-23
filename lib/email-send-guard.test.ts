import { describe, expect, it } from "vitest";
import {
  buildEmailSendDedupeKey,
  dedupeEmailSendBatch,
  filterEmailCampaignTargets,
  FOLLOW_UP_DELAY_DAYS,
  followUpEligibleAt,
  isFollowUpDue,
  normalizeRecipientEmail,
  screenEmailRecipient,
} from "@/lib/email-send-guard";

describe("email send guard", () => {
  it("normalizes recipient emails before building dedupe keys", () => {
    const first = buildEmailSendDedupeKey({
      recipientEmail: "  KLIENT@example.com ",
      scope: "cold-base",
      campaignKey: "Maj-2026",
      templateKey: "intro"
    });
    const second = buildEmailSendDedupeKey({
      recipientEmail: "klient@example.com",
      scope: "cold-base",
      campaignKey: "maj-2026",
      templateKey: "INTRO"
    });

    expect(normalizeRecipientEmail("  KLIENT@example.com ")).toBe("klient@example.com");
    expect(first).toBe(second);
  });

  it("keeps only the first send for the same recipient and campaign", () => {
    const result = dedupeEmailSendBatch([
      { recipientEmail: "a@example.com", scope: "bot", campaignKey: "week-1" },
      { recipientEmail: " A@example.com ", scope: "bot", campaignKey: "week-1" },
      { recipientEmail: "a@example.com", scope: "bot", campaignKey: "week-2" }
    ]);

    expect(result.ready).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].firstIndex).toBe(0);
  });

  it("blocks legal, police and public-unit targets before a campaign send", () => {
    expect(screenEmailRecipient({ recipientEmail: "kontakt@kancelaria-example.pl" })).toEqual(
      expect.objectContaining({ allowed: false, reason: "blocked_sector" })
    );
    expect(screenEmailRecipient({ recipientEmail: "sekretariat@policja.gov.pl" })).toEqual(
      expect.objectContaining({ allowed: false, reason: "blocked_sector" })
    );
    expect(
      screenEmailRecipient({
        recipientEmail: "kontakt@example.com",
        companyName: "Urząd Gminy Testowo"
      })
    ).toEqual(expect.objectContaining({ allowed: false, reason: "blocked_sector" }));
    expect(screenEmailRecipient({ recipientEmail: "sekretariat@szkola.edu.pl" })).toEqual(
      expect.objectContaining({ allowed: false, reason: "blocked_sector" })
    );
    expect(
      screenEmailRecipient({
        recipientEmail: "kontakt@example.com",
        companyName: "Szpital Publiczny"
      })
    ).toEqual(expect.objectContaining({ allowed: false, reason: "blocked_sector" }));
  });

  it("separates allowed targets from suppressed campaign targets", () => {
    const result = filterEmailCampaignTargets([
      { recipientEmail: "firma@example.com", scope: "cold-base" },
      { recipientEmail: "sekretariat@urzad.example", scope: "cold-base" }
    ]);

    expect(result.allowed).toHaveLength(1);
    expect(result.suppressed).toHaveLength(1);
  });

  it("does not allow follow-up before seven days", () => {
    const sentAt = "2026-05-01T10:00:00.000Z";

    expect(FOLLOW_UP_DELAY_DAYS).toBe(7);
    expect(followUpEligibleAt(sentAt).toISOString()).toBe("2026-05-08T10:00:00.000Z");
    expect(isFollowUpDue(sentAt, "2026-05-08T09:59:59.000Z")).toBe(false);
    expect(isFollowUpDue(sentAt, "2026-05-08T10:00:00.000Z")).toBe(true);
  });
});

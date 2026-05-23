import type { CrmDataScope } from "@/lib/types";

export type EmailSendGuardInput = {
  recipientEmail: string;
  scope: string;
  crmEnvironment?: CrmDataScope | null;
  leadId?: string | null;
  customerId?: string | null;
  campaignKey?: string | null;
  templateKey?: string | null;
  contentHash?: string | null;
};

export type EmailRecipientScreeningInput = {
  recipientEmail: string;
  displayName?: string | null;
  companyName?: string | null;
  sourceLabel?: string | null;
};

export type EmailRecipientScreeningResult =
  | { allowed: true }
  | { allowed: false; reason: "invalid_email" | "blocked_sector"; matchedTerm?: string };

export type EmailSendClaim<T extends EmailSendGuardInput> = {
  item: T;
  index: number;
  dedupeKey: string;
};

export type EmailSendDuplicate<T extends EmailSendGuardInput> = EmailSendClaim<T> & {
  firstIndex: number;
};

const emptyKeyPart = "none";
export const FOLLOW_UP_DELAY_DAYS = 7;

const blockedRecipientTerms = [
  "adwokat",
  "kancelaria",
  "komornik",
  "legal",
  "notariusz",
  "prawna",
  "prawne",
  "prawnik",
  "radca",
  "policja",
  "komenda",
  "prokuratura",
  "straz",
  "sad",
  "szkola",
  "przedszkole",
  "szpital",
  "uczelnia",
  "uniwersytet",
  "kuratorium",
  "zus",
  "nfz",
  "mops",
  "ops",
  "urzad",
  "gmina",
  "starostwo",
  "powiat",
  "ministerstwo",
  "inspektorat",
  "jednostka"
];

const blockedDomainFragments = [
  "policja.gov.pl",
  "prokuratura.gov.pl",
  "edu.pl",
  "zus.pl",
  "nfz.gov.pl",
  "starostwo",
  "urzad",
  "gmina",
  "szkola",
  "szpital",
  "kancelaria",
  "adwokat",
  "radca",
  "notariusz",
  "komornik"
];

const blockedDomainPrefixes = ["um.", "ug.", "zus."];

function normalizeKeyPart(value?: string | null) {
  return value?.trim().toLowerCase() || emptyKeyPart;
}

export function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeScreeningText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function screenEmailRecipient(input: EmailRecipientScreeningInput): EmailRecipientScreeningResult {
  const recipientEmail = normalizeRecipientEmail(input.recipientEmail);

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { allowed: false, reason: "invalid_email" };
  }

  const domain = normalizeScreeningText(recipientEmail.split("@")[1] || "");
  const governmentDomain = domain === "gov.pl" || domain.endsWith(".gov.pl");
  const domainPrefixMatch = blockedDomainPrefixes.find((term) => domain.startsWith(term));
  const domainFragmentMatch = blockedDomainFragments.find((term) => domain.includes(term));
  const domainMatch = governmentDomain ? ".gov.pl" : domainPrefixMatch || domainFragmentMatch;

  if (domainMatch) {
    return { allowed: false, reason: "blocked_sector", matchedTerm: domainMatch };
  }

  const context = normalizeScreeningText(
    [recipientEmail, input.displayName, input.companyName, input.sourceLabel].filter(Boolean).join(" ")
  );
  const termMatch = blockedRecipientTerms.find((term) => context.includes(term));

  if (termMatch) {
    return { allowed: false, reason: "blocked_sector", matchedTerm: termMatch };
  }

  return { allowed: true };
}

export function followUpEligibleAt(sentAt: Date | string, delayDays = FOLLOW_UP_DELAY_DAYS) {
  const date = typeof sentAt === "string" ? new Date(sentAt) : new Date(sentAt);
  date.setUTCDate(date.getUTCDate() + delayDays);
  return date;
}

export function isFollowUpDue(sentAt: Date | string, now: Date | string = new Date()) {
  const currentDate = typeof now === "string" ? new Date(now) : now;
  return currentDate.getTime() >= followUpEligibleAt(sentAt).getTime();
}

export function buildEmailSendDedupeKey(input: EmailSendGuardInput) {
  const recipientEmail = normalizeRecipientEmail(input.recipientEmail);
  const scope = normalizeKeyPart(input.scope);

  if (!recipientEmail || !recipientEmail.includes("@")) {
    throw new Error("Recipient email is required before claiming an email send.");
  }

  if (scope === emptyKeyPart) {
    throw new Error("Email send scope is required before claiming an email send.");
  }

  return [
    "email-send",
    `env:${input.crmEnvironment || "production"}`,
    `scope:${scope}`,
    `recipient:${recipientEmail}`,
    `lead:${normalizeKeyPart(input.leadId)}`,
    `customer:${normalizeKeyPart(input.customerId)}`,
    `campaign:${normalizeKeyPart(input.campaignKey)}`,
    `template:${normalizeKeyPart(input.templateKey)}`,
    `content:${normalizeKeyPart(input.contentHash)}`
  ].join("|");
}

export function dedupeEmailSendBatch<T extends EmailSendGuardInput>(items: readonly T[]) {
  const seen = new Map<string, number>();
  const ready: Array<EmailSendClaim<T>> = [];
  const duplicates: Array<EmailSendDuplicate<T>> = [];

  items.forEach((item, index) => {
    const dedupeKey = buildEmailSendDedupeKey(item);
    const firstIndex = seen.get(dedupeKey);

    if (firstIndex !== undefined) {
      duplicates.push({ item, index, dedupeKey, firstIndex });
      return;
    }

    seen.set(dedupeKey, index);
    ready.push({ item, index, dedupeKey });
  });

  return { ready, duplicates };
}

export function filterEmailCampaignTargets<T extends EmailSendGuardInput & EmailRecipientScreeningInput>(
  items: readonly T[]
) {
  const allowed: T[] = [];
  const suppressed: Array<{ item: T; screening: Exclude<EmailRecipientScreeningResult, { allowed: true }> }> = [];

  items.forEach((item) => {
    const screening = screenEmailRecipient(item);

    if (screening.allowed) {
      allowed.push(item);
      return;
    }

    suppressed.push({ item, screening });
  });

  return { allowed, suppressed };
}

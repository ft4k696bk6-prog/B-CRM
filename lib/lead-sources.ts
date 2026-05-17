export const LEAD_SOURCES = ["własne", "polecenie", "B2B", "B2C"] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

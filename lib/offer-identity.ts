export type OfferIdentity = {
  fullName: string;
  phone: string;
};

export const OFFER_IDENTITY_STORAGE_KEY = "bcrm-offer-identity-v1";

export function defaultOfferIdentity(fullName = ""): OfferIdentity {
  return {
    fullName,
    phone: ""
  };
}

export function readOfferIdentity(fallbackFullName = ""): OfferIdentity {
  if (typeof window === "undefined") return defaultOfferIdentity(fallbackFullName);

  try {
    const raw = window.localStorage.getItem(OFFER_IDENTITY_STORAGE_KEY);
    if (!raw) return defaultOfferIdentity(fallbackFullName);
    const parsed = JSON.parse(raw) as Partial<OfferIdentity>;

    return {
      fullName: parsed.fullName?.trim() || fallbackFullName,
      phone: parsed.phone?.trim() || ""
    };
  } catch {
    return defaultOfferIdentity(fallbackFullName);
  }
}

export function writeOfferIdentity(identity: OfferIdentity) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    OFFER_IDENTITY_STORAGE_KEY,
    JSON.stringify({
      fullName: identity.fullName.trim(),
      phone: identity.phone.trim()
    })
  );
}

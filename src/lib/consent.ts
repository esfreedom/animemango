// Cookie consent for analytics. Declining is the default, so nothing optional loads until a visitor
// accepts (approved plan, section 6).

export const CONSENT_COOKIE = "consent";
export const CONSENT_MAX_AGE_S = 365 * 24 * 60 * 60;

export type ConsentValue = "accepted" | "declined";

export function parseConsent(value: string | undefined): ConsentValue | null {
  return value === "accepted" || value === "declined" ? value : null;
}

// GA4 measurement IDs look like G-XXXXXXXXXX. The check keeps the value safe to put in a script.
export function isGaMeasurementId(value: string | undefined): value is string {
  return typeof value === "string" && /^G-[A-Z0-9]{4,20}$/.test(value);
}

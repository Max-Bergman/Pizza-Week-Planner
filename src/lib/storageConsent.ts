/** User choice for browser storage (localStorage). Not HTTP cookies, but same UX bucket. */
export type StorageConsent = "accepted" | "declined" | "unknown";

const CONSENT_KEY = "pizza-week-storage-consent";

export function readStorageConsent(): StorageConsent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
  } catch {
    /* private mode */
  }
  return "unknown";
}

export function writeStorageConsent(choice: "accepted" | "declined"): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* */
  }
}

export function persistenceAllowed(consent: StorageConsent): boolean {
  return consent === "accepted";
}

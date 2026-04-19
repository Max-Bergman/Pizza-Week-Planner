import type { StorageConsent } from "./storageConsent";

const DEVICE_KEY = "pizza-week-device-id";

/**
 * Stable random id for optional community voting (one submission per category per id).
 * Only stored when storage consent is accepted.
 */
export function getOrCreateDeviceId(consent: StorageConsent): string | null {
  if (consent !== "accepted") return null;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

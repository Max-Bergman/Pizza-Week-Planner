import type { UserPreferences, Rating, AppStep } from "../types";
import type { BrowseFilters } from "./browseFilter";

export interface SharePayload {
  v: 2;
  prefs: UserPreferences;
  ratings: Record<string, Rating>;
  browseFilters: BrowseFilters;
  step?: AppStep;
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function decodeSharePayload(b64: string): SharePayload | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as SharePayload;
    if (data.v !== 2 || !data.prefs) return null;
    return data;
  } catch {
    return null;
  }
}

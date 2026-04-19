import LZString from "lz-string";
import type { UserPreferences, Rating, AppStep } from "../types";
import type { BrowseFilters } from "./browseFilter";

/** LZ-compressed JSON (URL-safe); legacy links are raw base64 without this prefix. */
const SHARE_LZ_PREFIX = "z1.";

export interface SharePayload {
  v: 2;
  prefs: UserPreferences;
  ratings: Record<string, Rating>;
  browseFilters: BrowseFilters;
  step?: AppStep;
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return SHARE_LZ_PREFIX + LZString.compressToEncodedURIComponent(json);
}

function decodeLegacyBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    let json: string;
    if (encoded.startsWith(SHARE_LZ_PREFIX)) {
      const inner = encoded.slice(SHARE_LZ_PREFIX.length);
      const decompressed = LZString.decompressFromEncodedURIComponent(inner);
      if (!decompressed) return null;
      json = decompressed;
    } else {
      json = decodeLegacyBase64(encoded);
    }
    const data = JSON.parse(json) as SharePayload;
    if (data.v !== 2 || !data.prefs) return null;
    return data;
  } catch {
    return null;
  }
}

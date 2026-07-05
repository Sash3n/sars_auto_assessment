/*
 * Bring-your-own-API-key storage for the cloud fallback. The key lives in
 * localStorage on this device only. It is never written to Firestore, never
 * sent to any backend of ours, and only travels directly from the browser
 * to the provider when the user explicitly consents to a cloud extraction.
 */

export const API_KEY_STORAGE_KEY = "sars-anthropic-api-key";

export function loadApiKey(): string {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key.trim() === "") {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    }
  } catch {
    // Storage unavailable. The key can still be used for this session
    // by holding it in component state.
  }
}

export function clearApiKey(): void {
  saveApiKey("");
}

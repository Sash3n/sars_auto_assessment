import { emptyAppData } from "@/lib/model/defaults";
import type { AppData } from "@/lib/model/types";

/*
 * Versioned local persistence. Phase 5 layers encrypted Firestore sync on
 * top; local storage stays the offline path so the app remains fully usable
 * without an account.
 */
export const APP_DATA_STORAGE_KEY = "sars-app-data-v1";

export function loadAppData(): AppData {
  try {
    const raw = window.localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (!raw) {
      return emptyAppData();
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { schemaVersion?: unknown }).schemaVersion !== 1 ||
      typeof (parsed as { activeTaxYearId?: unknown }).activeTaxYearId !==
        "string" ||
      typeof (parsed as { years?: unknown }).years !== "object"
    ) {
      return emptyAppData();
    }
    return parsed as AppData;
  } catch {
    return emptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  try {
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or private mode. The in-memory state stays authoritative.
  }
}

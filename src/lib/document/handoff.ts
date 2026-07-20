import type { ComparisonRow } from "@/lib/tax-engine/compare";

/*
 * The parsed SARS ITA34 a user pastes or imports on the Compare page lives
 * only in that page's component state, it is never written to AppData. To
 * open the same comparison as an ITA34-styled document on its own route,
 * the already-computed comparison rows are handed off through
 * sessionStorage: ephemeral and tab-scoped. Reading does not clear the
 * entry (a read happens inside render/effect timing, where React's Strict
 * Mode dev double-invocation would otherwise see it already gone on the
 * second call); it is simply overwritten the next time the Compare page
 * writes a fresh comparison. If the handoff is missing (direct navigation,
 * a different tab), the statement page falls back to the solo assessment
 * view.
 */

const HANDOFF_KEY = "sars-statement-handoff-v1";

export interface ComparisonHandoff {
  yearLabel: string;
  rows: ComparisonRow[];
}

export function writeComparisonHandoff(payload: ComparisonHandoff): void {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // Storage disabled or full, the statement page falls back to solo mode.
  }
}

export function readComparisonHandoff(): ComparisonHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { yearLabel?: unknown }).yearLabel !== "string" ||
      !Array.isArray((parsed as { rows?: unknown }).rows)
    ) {
      return null;
    }
    return parsed as ComparisonHandoff;
  } catch {
    return null;
  }
}

import { afterEach, describe, expect, it } from "vitest";
import { emptyAppData, emptyPayslip } from "@/lib/model/defaults";
import {
  APP_DATA_STORAGE_KEY,
  loadAppData,
  saveAppData,
} from "@/lib/store/storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("storage", () => {
  it("round-trips app data", () => {
    const data = emptyAppData();
    data.years["2025-26"].payslips.push({
      ...emptyPayslip("2025-03"),
      employer: "Acme",
      basicSalary: 30_000,
    });
    saveAppData(data);
    const loaded = loadAppData();
    expect(loaded.years["2025-26"].payslips[0].employer).toBe("Acme");
    expect(loaded.years["2025-26"].payslips[0].basicSalary).toBe(30_000);
  });

  it("returns fresh data when nothing is stored", () => {
    const loaded = loadAppData();
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.activeTaxYearId).toBe("2025-26");
  });

  it("recovers from corrupted JSON", () => {
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, "{not json");
    expect(loadAppData().schemaVersion).toBe(1);
  });

  it("discards an unknown schema version", () => {
    window.localStorage.setItem(
      APP_DATA_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, years: {} }),
    );
    const loaded = loadAppData();
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.years["2025-26"]).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { emptyAppData, normalizeAppData } from "@/lib/model/defaults";
import type { AppData } from "@/lib/model/types";

/*
 * Data saved by earlier versions of the app (local storage or an
 * encrypted cloud backup) predates the travel claim, the home office
 * area fields, and donation certificates. Normalisation fills every
 * missing field with its default so the tax engine never sees undefined.
 */
describe("normalizeAppData", () => {
  it("fills fields missing from legacy stored data", () => {
    const legacy = emptyAppData() as unknown as Record<string, unknown>;
    const year = (legacy.years as Record<string, Record<string, unknown>>)[
      legacy.activeTaxYearId as string
    ];
    delete year.travel;
    const profile = year.profile as Record<string, unknown>;
    delete profile.homeOfficeAreaM2;
    delete profile.homeTotalAreaM2;
    delete profile.homeOfficeRunningCosts;
    delete profile.donationCertificates;

    const normalized = normalizeAppData(legacy as unknown as AppData);
    const active = normalized.years[normalized.activeTaxYearId];
    expect(active.travel).toEqual({
      allowanceReceived: 0,
      totalKm: 0,
      businessKm: 0,
      vehicleValue: 0,
      paidFullFuel: true,
      paidFullMaintenance: true,
    });
    expect(active.profile.homeOfficeAreaM2).toBe(0);
    expect(active.profile.homeTotalAreaM2).toBe(0);
    expect(active.profile.homeOfficeRunningCosts).toBe(0);
    expect(active.profile.donationCertificates).toEqual([]);
  });

  it("keeps captured values untouched", () => {
    const data = emptyAppData();
    const year = data.years[data.activeTaxYearId];
    year.travel.allowanceReceived = 24_000;
    year.profile.donations = 1_000;
    const normalized = normalizeAppData(data);
    const active = normalized.years[normalized.activeTaxYearId];
    expect(active.travel.allowanceReceived).toBe(24_000);
    expect(active.profile.donations).toBe(1_000);
  });
});

import { describe, expect, it } from "vitest";
import { travelDeduction } from "@/lib/tax-engine/travel";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

/*
 * Reference values from the official SARS cost scale tables:
 * - 2026/27: PAYE-GEN-01-G03-A01 Rate per Kilometre Schedule, revision 19,
 *   effective 1 March 2026.
 * - 2025/26, 2024/25, 2023/24: the SARS eLogbook fixed cost tables for
 *   each year.
 * The deemed rate per km is the fixed cost divided by total kilometres,
 * plus the fuel and maintenance rates where the taxpayer bore those costs
 * in full. The deduction is the rate times business kilometres, capped at
 * the travel allowance received.
 */

const claim = {
  allowanceReceived: 60_000,
  totalKm: 30_000,
  businessKm: 10_000,
  vehicleValue: 250_000,
  paidFullFuel: true,
  paidFullMaintenance: true,
};

describe("travel deemed cost tables", () => {
  it("captures the 2023/24 cost scale", () => {
    const bands = getTaxYear("2023-24").travelDeemedCost;
    expect(bands[0]).toEqual({
      maxVehicleValue: 100_000,
      fixedCost: 33_760,
      fuelCentsPerKm: 141.5,
      maintenanceCentsPerKm: 43.8,
    });
    expect(bands[5]).toEqual({
      maxVehicleValue: 600_000,
      fixedCost: 158_856,
      fuelCentsPerKm: 226.6,
      maintenanceCentsPerKm: 91.0,
    });
    expect(bands[bands.length - 1]).toEqual({
      maxVehicleValue: null,
      fixedCost: 209_685,
      fuelCentsPerKm: 234.3,
      maintenanceCentsPerKm: 113.1,
    });
  });

  it("captures the 2024/25 cost scale", () => {
    const bands = getTaxYear("2024-25").travelDeemedCost;
    expect(bands[0]).toEqual({
      maxVehicleValue: 100_000,
      fixedCost: 34_480,
      fuelCentsPerKm: 151.7,
      maintenanceCentsPerKm: 46.0,
    });
    expect(bands[bands.length - 1]).toEqual({
      maxVehicleValue: null,
      fixedCost: 215_447,
      fuelCentsPerKm: 251.2,
      maintenanceCentsPerKm: 118.9,
    });
  });

  it("captures the 2025/26 cost scale", () => {
    const bands = getTaxYear("2025-26").travelDeemedCost;
    expect(bands[0]).toEqual({
      maxVehicleValue: 100_000,
      fixedCost: 33_940,
      fuelCentsPerKm: 146.7,
      maintenanceCentsPerKm: 47.4,
    });
    expect(bands[2]).toEqual({
      maxVehicleValue: 300_000,
      fixedCost: 87_497,
      fuelCentsPerKm: 177.9,
      maintenanceCentsPerKm: 65.4,
    });
    expect(bands[bands.length - 1]).toEqual({
      maxVehicleValue: null,
      fixedCost: 211_121,
      fuelCentsPerKm: 242.9,
      maintenanceCentsPerKm: 122.5,
    });
  });

  it("captures the 2026/27 cost scale with its new value bands", () => {
    const bands = getTaxYear("2026-27").travelDeemedCost;
    expect(bands[0]).toEqual({
      maxVehicleValue: 115_000,
      fixedCost: 38_344,
      fuelCentsPerKm: 132.9,
      maintenanceCentsPerKm: 49.1,
    });
    expect(bands[7]).toEqual({
      maxVehicleValue: 920_000,
      fixedCost: 237_679,
      fuelCentsPerKm: 220.1,
      maintenanceCentsPerKm: 126.1,
    });
    // The open band's maintenance rate differs from the band below it.
    expect(bands[bands.length - 1]).toEqual({
      maxVehicleValue: null,
      fixedCost: 237_679,
      fuelCentsPerKm: 220.1,
      maintenanceCentsPerKm: 126.9,
    });
  });
});

describe("travelDeduction", () => {
  const tables2025 = getTaxYear("2025-26");
  const tables2026 = getTaxYear("2026-27");

  it("computes the deemed cost deduction for a mid-band vehicle", () => {
    // 87,497 / 30,000 km + R1.779 + R0.654 = R5.34957 per km.
    const result = travelDeduction(claim, tables2025);
    expect(result.ratePerKm).toBeCloseTo(5.34957, 4);
    expect(result.deemedCost).toBe(53_495.67);
    expect(result.allowed).toBe(53_495.67);
  });

  it("caps the deduction at the allowance received", () => {
    const result = travelDeduction(
      { ...claim, allowanceReceived: 40_000 },
      tables2025,
    );
    expect(result.deemedCost).toBe(53_495.67);
    expect(result.allowed).toBe(40_000);
  });

  it("excludes the fuel component when fuel was not fully borne", () => {
    // 87,497 / 30,000 + R0.654 maintenance only.
    const result = travelDeduction(
      { ...claim, paidFullFuel: false },
      tables2025,
    );
    expect(result.deemedCost).toBe(35_705.67);
  });

  it("excludes the maintenance component when not fully borne", () => {
    // 87,497 / 30,000 + R1.779 fuel only.
    const result = travelDeduction(
      { ...claim, paidFullMaintenance: false },
      tables2025,
    );
    expect(result.deemedCost).toBe(46_955.67);
  });

  it("clamps business kilometres to total kilometres", () => {
    const clamped = travelDeduction(
      { ...claim, businessKm: 40_000 },
      tables2025,
    );
    const full = travelDeduction({ ...claim, businessKm: 30_000 }, tables2025);
    expect(clamped.deemedCost).toBe(full.deemedCost);
  });

  it("uses the year's own bands: the same vehicle lands differently in 2026/27", () => {
    const input = {
      allowanceReceived: 100_000,
      totalKm: 20_000,
      businessKm: 8_000,
      vehicleValue: 200_000,
      paidFullFuel: true,
      paidFullMaintenance: true,
    };
    // 2025/26 band 2: 60,688 fixed, 163.8c, 59.3c.
    expect(travelDeduction(input, tables2025).deemedCost).toBe(42_123.2);
    // 2026/27 band 2: 68,487 fixed, 148.4c, 61.4c.
    expect(travelDeduction(input, tables2026).deemedCost).toBe(44_178.8);
  });

  it("treats a value on a band boundary as inside the lower band", () => {
    const result = travelDeduction(
      { ...claim, vehicleValue: 100_000, totalKm: 10_000, businessKm: 10_000 },
      tables2025,
    );
    // 33,940 / 10,000 + R1.467 + R0.474 = R5.335 per km.
    expect(result.ratePerKm).toBeCloseTo(5.335, 4);
  });

  it("returns zero when there is no allowance, no kilometres, or no vehicle value", () => {
    expect(
      travelDeduction({ ...claim, allowanceReceived: 0 }, tables2025).allowed,
    ).toBe(0);
    expect(
      travelDeduction({ ...claim, totalKm: 0 }, tables2025).allowed,
    ).toBe(0);
    expect(
      travelDeduction({ ...claim, businessKm: 0 }, tables2025).allowed,
    ).toBe(0);
    expect(
      travelDeduction({ ...claim, vehicleValue: 0 }, tables2025).allowed,
    ).toBe(0);
  });
});

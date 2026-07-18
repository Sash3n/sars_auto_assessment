import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ResultsPage from "@/components/pages/ResultsPage";
import { emptyAppData, emptyPayslip, emptyRental } from "@/lib/model/defaults";
import { APP_DATA_STORAGE_KEY } from "@/lib/store/storage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

function seedYear(basicSalary: number, paye: number) {
  const data = emptyAppData();
  data.years["2025-26"].profile.dateOfBirth = "1990-06-15";
  data.years["2025-26"].payslips = [
    {
      ...emptyPayslip("2025-03"),
      employer: "Acme",
      basicSalary,
      paye,
    },
  ];
  window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
}

describe("ResultsPage", () => {
  it("shows an empty state before anything is captured", () => {
    renderWithStore(<ResultsPage />);
    expect(screen.getByText(/nothing captured yet/i)).toBeInTheDocument();
  });

  it("shows an owed amount with the ITA34 structure", async () => {
    // Tax on 240 000 is 26 197 after the rebate; PAYE 20 000 paid.
    seedYear(240_000, 20_000);
    renderWithStore(<ResultsPage />);

    expect(
      await screen.findByText(/you owe sars r 6 197\.00/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Income, taxable")).toBeInTheDocument();
    expect(screen.getByText(/assessed tax after rebates/i)).toBeInTheDocument();
    expect(
      screen.getByText(/tax credits and adjustments/i),
    ).toBeInTheDocument();
  });

  it("shows a refund in the positive framing", async () => {
    seedYear(240_000, 30_000);
    renderWithStore(<ResultsPage />);
    expect(
      await screen.findByText(/sars owes you r 3 803\.00/i),
    ).toBeInTheDocument();
  });

  it("names the IRP6 payment dates when non-PAYE income likely means provisional status", async () => {
    const data = emptyAppData();
    data.years["2025-26"].profile.dateOfBirth = "1990-06-15";
    data.years["2025-26"].payslips = [
      { ...emptyPayslip("2025-03"), employer: "Acme", basicSalary: 240_000, paye: 20_000 },
    ];
    data.years["2025-26"].rentals = [
      { ...emptyRental(), name: "Flat", rentalIncome: 60_000 },
    ];
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
    renderWithStore(<ResultsPage />);

    expect(
      await screen.findByText(/provisional taxpayer.*end of august and february/i),
    ).toBeInTheDocument();
  });
});

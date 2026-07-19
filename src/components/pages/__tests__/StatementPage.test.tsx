import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StatementPage from "@/components/pages/StatementPage";
import { writeComparisonHandoff } from "@/lib/document/handoff";
import { emptyAppData, emptyPayslip } from "@/lib/model/defaults";
import { APP_DATA_STORAGE_KEY } from "@/lib/store/storage";
import { renderWithStore } from "@/test/renderWithStore";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  searchParams.delete("mode");
});

function seedYear() {
  const data = emptyAppData();
  data.years["2025-26"].profile.dateOfBirth = "1990-06-15";
  data.years["2025-26"].payslips = [
    {
      ...emptyPayslip("2025-03"),
      employer: "Acme",
      basicSalary: 360_000,
      paye: 72_000,
    },
  ];
  window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
}

describe("StatementPage", () => {
  it("renders the solo assessment in ITA34 section layout by default", async () => {
    seedYear();
    renderWithStore(<StatementPage />);

    expect(
      await screen.findByText("Balance of Account after this Assessment"),
    ).toBeInTheDocument();
    expect(screen.getByText("Assessment Summary Information")).toBeInTheDocument();
    expect(
      screen.getByText("Employment income [IRP5/IT3(a)]"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not an official sars document/i),
    ).toBeInTheDocument();
  });

  it("renders the comparison layout when a handoff is present and mode=compare", async () => {
    seedYear();
    searchParams.set("mode", "compare");
    writeComparisonHandoff({
      yearLabel: "2025/26",
      rows: [
        {
          code: "3601",
          description: "Income, taxable",
          mineAmount: 360_000,
          sarsAmount: 355_000,
          delta: 5_000,
          status: "mismatch",
        },
      ],
    });

    renderWithStore(<StatementPage />);

    expect(
      await screen.findByText(/comparison with sars, 2025\/26/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Your calculation")).toBeInTheDocument();
    expect(screen.getByText("SARS assessment")).toBeInTheDocument();
  });

  it("falls back to the solo view when mode=compare has no handoff to read", async () => {
    seedYear();
    searchParams.set("mode", "compare");

    renderWithStore(<StatementPage />);

    expect(
      await screen.findByText("Balance of Account after this Assessment"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/comparison with sars/i)).not.toBeInTheDocument();
  });
});

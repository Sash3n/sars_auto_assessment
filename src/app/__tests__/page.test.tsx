import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { emptyAppData, emptyPayslip } from "@/lib/model/defaults";
import { APP_DATA_STORAGE_KEY } from "@/lib/store/storage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

describe("HomePage dashboard", () => {
  it("shows the capture-first landing when nothing is captured", () => {
    renderWithStore(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /sars auto-assessment calculator/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /capture payslips/i }),
    ).toHaveAttribute("href", "/income");
    expect(
      screen.getByRole("link", { name: /capture other income/i }),
    ).toHaveAttribute("href", "/other-income");
    expect(
      screen.getByRole("link", { name: /capture deductions/i }),
    ).toHaveAttribute("href", "/deductions");
  });

  it("becomes the dashboard once income exists", async () => {
    const data = emptyAppData();
    data.years["2025-26"].profile.dateOfBirth = "1990-06-15";
    data.years["2025-26"].profile.privateRetirementContributions = 20_000;
    data.years["2025-26"].payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 240_000,
        paye: 30_000,
      },
    ];
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));

    renderWithStore(<HomePage />);

    expect(
      await screen.findByText(/sars owes you/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tax brackets/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /monthly income and paye/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /deduction breakdown/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /year over year/i }),
    ).toBeInTheDocument();
    // The bracket marker names the marginal bracket.
    expect(screen.getByText(/marginal bracket/i)).toBeInTheDocument();
    // Deduction slice with its share.
    expect(screen.getByText(/retirement fund contributions/i)).toBeInTheDocument();
    // Year-over-year row for the active year.
    expect(screen.getByText("2025/26")).toBeInTheDocument();
  });
});

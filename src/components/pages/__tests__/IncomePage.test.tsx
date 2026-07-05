import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import IncomePage from "@/components/pages/IncomePage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

describe("IncomePage", () => {
  it("starts empty with a call to add the first payslip", () => {
    renderWithStore(<IncomePage />);
    expect(screen.getByText(/no payslips captured yet/i)).toBeInTheDocument();
  });

  it("adds a payslip through the form and shows it with totals", async () => {
    const user = userEvent.setup();
    renderWithStore(<IncomePage />);

    await user.click(screen.getByRole("button", { name: /add payslip/i }));
    await user.type(screen.getByLabelText("Employer"), "Acme Ltd");
    await user.type(screen.getByLabelText("Basic salary"), "30000");
    await user.type(screen.getByLabelText("PAYE"), "6000");
    await user.click(screen.getByRole("button", { name: /save payslip/i }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("Acme Ltd")).toBeInTheDocument();
    expect(within(table).getByText("R 30 000.00")).toBeInTheDocument();
    expect(within(table).getByText("R 6 000.00")).toBeInTheDocument();
    // Summary cards reflect the same figures.
    expect(screen.getByText(/gross payroll income/i)).toBeInTheDocument();
  });

  it("removes a payslip", async () => {
    const user = userEvent.setup();
    renderWithStore(<IncomePage />);

    await user.click(screen.getByRole("button", { name: /add payslip/i }));
    await user.type(screen.getByLabelText("Employer"), "Acme Ltd");
    await user.click(screen.getByRole("button", { name: /save payslip/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove payslip acme ltd/i }),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("captures named allowances inside the payslip form", async () => {
    const user = userEvent.setup();
    renderWithStore(<IncomePage />);

    await user.click(screen.getByRole("button", { name: /add payslip/i }));
    await user.type(screen.getByLabelText("Employer"), "Acme Ltd");
    await user.click(screen.getByRole("button", { name: /add allowance/i }));
    await user.type(
      screen.getByLabelText("Allowances description"),
      "Phone",
    );
    const amountInputs = screen.getAllByLabelText("Amount");
    await user.type(amountInputs[amountInputs.length - 1], "500");
    await user.click(screen.getByRole("button", { name: /save payslip/i }));

    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

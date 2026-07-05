import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import ComparePage from "@/components/pages/ComparePage";
import { emptyAppData, emptyPayslip } from "@/lib/model/defaults";
import { APP_DATA_STORAGE_KEY } from "@/lib/store/storage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

function seed() {
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

async function pasteAndCompare(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.click(screen.getByLabelText("Pasted ITA34 text"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: /^compare$/i }));
}

describe("ComparePage", () => {
  it("diffs a matching SARS line as a match", async () => {
    seed();
    const user = userEvent.setup();
    renderWithStore(<ComparePage />);

    await pasteAndCompare(user, "3601 Income, taxable 360 000");

    const table = await screen.findByRole("table");
    const row = within(table).getByText("Income, taxable").closest("tr")!;
    expect(within(row).getByText("match")).toBeInTheDocument();
  });

  it("flags a difference above the threshold as a mismatch with its delta", async () => {
    seed();
    const user = userEvent.setup();
    renderWithStore(<ComparePage />);

    await pasteAndCompare(user, "3601 Income, taxable 350 000");

    const table = await screen.findByRole("table");
    const row = within(table).getByText("Income, taxable").closest("tr")!;
    expect(within(row).getByText("mismatch")).toBeInTheDocument();
    expect(within(row).getByText("R 10 000.00")).toBeInTheDocument();
    expect(screen.getByText(/1 mismatch/i)).toBeInTheDocument();
  });

  it("shows unread SARS figures as not available with a manual input", async () => {
    seed();
    const user = userEvent.setup();
    renderWithStore(<ComparePage />);

    await pasteAndCompare(user, "Taxable income 360 000");

    const table = await screen.findByRole("table");
    const row = within(table).getByText("Income, taxable").closest("tr")!;
    expect(within(row).getByText("not available")).toBeInTheDocument();
    expect(
      within(row).getByLabelText(/sars value for income, taxable/i),
    ).toBeInTheDocument();
  });

  it("completes the comparison when the user fills a missing value manually", async () => {
    seed();
    const user = userEvent.setup();
    renderWithStore(<ComparePage />);

    await pasteAndCompare(user, "Taxable income 360 000");

    const table = await screen.findByRole("table");
    const row = within(table).getByText("Income, taxable").closest("tr")!;
    await user.type(
      within(row).getByLabelText(/sars value for income, taxable/i),
      "360000",
    );

    const updatedRow = screen.getByText("Income, taxable").closest("tr")!;
    expect(within(updatedRow).getByText("match")).toBeInTheDocument();
  });
});

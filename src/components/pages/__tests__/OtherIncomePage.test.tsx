import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import OtherIncomePage from "@/components/pages/OtherIncomePage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

describe("OtherIncomePage", () => {
  it("captures local interest", async () => {
    const user = userEvent.setup();
    renderWithStore(<OtherIncomePage />);
    const interest = screen.getByLabelText("Local interest received");
    await user.type(interest, "25000");
    expect((interest as HTMLInputElement).value).toBe("25000");
  });

  it("adds a rental property with an expense and shows its net", async () => {
    const user = userEvent.setup();
    renderWithStore(<OtherIncomePage />);

    await user.click(screen.getByRole("button", { name: /add property/i }));
    await user.type(screen.getByLabelText("Property name"), "Garden flat");
    await user.type(
      screen.getByLabelText("Rental income for the year"),
      "120000",
    );
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    await user.type(
      screen.getByLabelText("Deductible expenses description"),
      "Levies",
    );
    await user.type(screen.getByLabelText("Amount"), "24000");
    await user.click(screen.getByRole("button", { name: /save property/i }));

    expect(screen.getByText("Garden flat")).toBeInTheDocument();
    expect(screen.getByText(/net rental income/i)).toBeInTheDocument();
    // Appears twice: on the property row and in the section total.
    expect(screen.getAllByText("R 96 000.00")).toHaveLength(2);
  });

  it("adds and removes a freelance item", async () => {
    const user = userEvent.setup();
    renderWithStore(<OtherIncomePage />);

    await user.click(screen.getByRole("button", { name: /add item/i }));
    await user.type(
      screen.getByLabelText("Freelance description"),
      "Weekend design work",
    );
    await user.type(screen.getByLabelText("Income"), "40000");
    await user.type(screen.getByLabelText("Expenses"), "10000");
    expect(screen.getByText(/net freelance income/i)).toBeInTheDocument();
    expect(screen.getByText("R 30 000.00")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /remove freelance item weekend design work/i,
      }),
    );
    expect(
      screen.getByText(/no freelance or side income captured/i),
    ).toBeInTheDocument();
  });

  it("adds a primary residence disposal", async () => {
    const user = userEvent.setup();
    renderWithStore(<OtherIncomePage />);

    await user.click(screen.getByRole("button", { name: /add disposal/i }));
    await user.type(
      screen.getByLabelText("Disposal description"),
      "Family home",
    );
    await user.type(screen.getByLabelText("Proceeds"), "3500000");
    await user.type(screen.getByLabelText("Base cost"), "1000000");
    await user.click(
      screen.getByRole("checkbox", { name: /primary residence/i }),
    );
    await user.click(screen.getByRole("button", { name: /save disposal/i }));

    expect(screen.getByText("Family home")).toBeInTheDocument();
    // Net gain after the 2025/26 R2m primary residence exclusion.
    expect(screen.getByText("R 500 000.00")).toBeInTheDocument();
  });
});

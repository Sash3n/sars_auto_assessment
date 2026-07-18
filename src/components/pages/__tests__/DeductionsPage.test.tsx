import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import DeductionsPage from "@/components/pages/DeductionsPage";
import { renderWithStore } from "@/test/renderWithStore";

afterEach(() => {
  window.localStorage.clear();
});

describe("DeductionsPage", () => {
  it("captures taxpayer details", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    const dob = screen.getByLabelText("Date of birth");
    await user.type(dob, "1990-06-15");
    expect((dob as HTMLInputElement).value).toBe("1990-06-15");

    const months = screen.getByLabelText(
      "Months as medical scheme main member",
    );
    await user.clear(months);
    await user.type(months, "12");
    expect((months as HTMLInputElement).value).toBe("12");
  });

  it("adds a dependent with scheme cover and disability", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    await user.click(screen.getByRole("button", { name: /add dependent/i }));
    expect(screen.getByLabelText("Relationship")).toBeInTheDocument();

    const months = screen.getByLabelText("Months on medical scheme");
    await user.clear(months);
    await user.type(months, "9");
    expect((months as HTMLInputElement).value).toBe("9");

    await user.click(
      screen.getByRole("checkbox", { name: /dependent has a disability/i }),
    );
    expect(
      screen.getByRole("checkbox", { name: /dependent has a disability/i }),
    ).toBeChecked();
  });

  it("removes a dependent", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    await user.click(screen.getByRole("button", { name: /add dependent/i }));
    await user.click(
      screen.getByRole("button", { name: /remove dependent/i }),
    );
    expect(screen.getByText(/no dependents captured/i)).toBeInTheDocument();
  });

  it("captures medical and other deduction amounts", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    const donations = screen.getByLabelText(
      "Donations without individual certificates",
    );
    await user.type(donations, "5000");
    expect((donations as HTMLInputElement).value).toBe("5000");

    const carryForward = screen.getByLabelText(
      "Retirement excess carried forward",
    );
    await user.type(carryForward, "15000");
    expect((carryForward as HTMLInputElement).value).toBe("15000");
  });
});

describe("DeductionsPage travel and home office", () => {
  it("computes the travel deduction preview from logbook inputs", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    await user.type(
      screen.getByLabelText("Travel allowance received for the year"),
      "60000",
    );
    await user.type(screen.getByLabelText("Vehicle value"), "250000");
    await user.type(
      screen.getByLabelText("Total kilometres for the year"),
      "30000",
    );
    await user.type(
      screen.getByLabelText("Business kilometres from the logbook"),
      "10000",
    );
    // 87 497 / 30 000 + 1.779 + 0.654 = R5.35/km, times 10 000 km.
    expect(screen.getByText(/R 5\.35\/km/)).toBeInTheDocument();
    expect(screen.getByText("R 53 495.67")).toBeInTheDocument();
  });

  it("shows the area based home office share", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    await user.type(
      screen.getByLabelText("Office area in square metres"),
      "12",
    );
    await user.type(
      screen.getByLabelText("Total home area in square metres"),
      "150",
    );
    await user.type(
      screen.getByLabelText("Annual home running costs"),
      "50000",
    );
    expect(screen.getByText("8.00%")).toBeInTheDocument();
    expect(screen.getByText("R 4 000.00")).toBeInTheDocument();
  });

  it("captures itemised donation certificates", async () => {
    const user = userEvent.setup();
    renderWithStore(<DeductionsPage />);

    await user.click(
      screen.getByRole("button", { name: /add certificate/i }),
    );
    await user.type(
      screen.getByLabelText(
        "Donation certificates (section 18A) description",
      ),
      "SPCA",
    );
    await user.type(screen.getByLabelText("Amount"), "1200");
    expect(screen.getByDisplayValue("SPCA")).toBeInTheDocument();
  });
});

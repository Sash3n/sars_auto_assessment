import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the app heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /sars auto-assessment calculator/i,
      }),
    ).toBeInTheDocument();
  });

  it("links into each capture section", () => {
    render(<HomePage />);
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
});

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

  it("renders the theme toggle", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("button", { name: /switch to .* mode/i }),
    ).toBeInTheDocument();
  });

  it("states plainly that it is not an official SARS product", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/not an official sars application/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not affiliated with or endorsed by sars/i),
    ).toBeInTheDocument();
  });
});

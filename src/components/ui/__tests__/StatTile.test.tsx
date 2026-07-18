import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatTile from "@/components/ui/StatTile";

describe("StatTile", () => {
  it("renders the label and value, and links to the given href", () => {
    render(
      <StatTile
        icon={<svg aria-hidden="true" />}
        label="Total income"
        value="R320,000.00"
        href="/income"
      />,
    );
    const link = screen.getByRole("link", { name: /total income/i });
    expect(link).toHaveAttribute("href", "/income");
    expect(screen.getByText("R320,000.00")).toBeInTheDocument();
  });
});

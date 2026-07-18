import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Accordion from "@/components/ui/Accordion";
import StickyActionBar from "@/components/ui/StickyActionBar";
import Stepper, { CAPTURE_FLOW_STEPS } from "@/components/ui/Stepper";

describe("Stepper", () => {
  it("renders every flow step as a link and marks the active one", () => {
    render(<Stepper activeIndex={2} />);
    const nav = within(
      screen.getByRole("navigation", { name: /capture progress/i }),
    );
    for (const step of CAPTURE_FLOW_STEPS) {
      expect(nav.getByRole("link", { name: step.label })).toHaveAttribute(
        "href",
        step.href,
      );
    }
    const active = nav.getByRole("link", { name: "Other income" });
    expect(active.closest("li")).toHaveAttribute("aria-current", "step");
  });
});

describe("Accordion", () => {
  it("starts collapsed by default and shows the summary figure", () => {
    render(
      <Accordion title="Rental properties" summary="R12,000.00">
        <p>section body</p>
      </Accordion>,
    );
    expect(screen.getByText("Rental properties")).toBeInTheDocument();
    expect(screen.getByText("R12,000.00")).toBeInTheDocument();
    expect(document.querySelector("details")).not.toHaveAttribute("open");
  });

  it("starts open when defaultOpen is set", () => {
    render(
      <Accordion title="Freelance" defaultOpen>
        <p>freelance body</p>
      </Accordion>,
    );
    expect(document.querySelector("details")).toHaveAttribute("open");
  });
});

describe("StickyActionBar", () => {
  it("renders its children", () => {
    render(
      <StickyActionBar>
        <span>Estimated refund</span>
      </StickyActionBar>,
    );
    expect(screen.getByText("Estimated refund")).toBeInTheDocument();
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/AppShell";
import { renderWithStore } from "@/test/renderWithStore";

vi.mock("next/navigation", () => ({
  usePathname: () => "/income",
}));

afterEach(() => {
  window.localStorage.clear();
});

describe("AppShell", () => {
  it("renders the navigation with the current page marked", () => {
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const income = screen.getByRole("link", { name: /income/i, current: "page" });
    expect(income).toHaveAttribute("href", "/income");
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("link", { name: /deductions/i }),
    ).toHaveAttribute("href", "/deductions");
  });

  it("renders the page content, theme toggle, and disclaimers", () => {
    renderWithStore(
      <AppShell>
        <p>the page body</p>
      </AppShell>,
    );
    expect(screen.getByText("the page body")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to .* mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not an official sars application/i),
    ).toBeInTheDocument();
  });

  it("switches the active tax year", async () => {
    const user = userEvent.setup();
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const select = screen.getByRole("combobox", { name: /tax year/i });
    await user.selectOptions(select, "2026-27");
    expect((select as HTMLSelectElement).value).toBe("2026-27");
  });
});

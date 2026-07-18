import { screen, within } from "@testing-library/react";
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

function sidebar() {
  return within(screen.getByRole("navigation", { name: /main navigation/i }));
}

describe("AppShell", () => {
  it("renders the navigation with the current page marked", () => {
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const income = sidebar().getByRole("link", {
      name: /^income$/i,
      current: "page",
    });
    expect(income).toHaveAttribute("href", "/income");
    expect(sidebar().getByRole("link", { name: /home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      sidebar().getByRole("link", { name: /deductions/i }),
    ).toHaveAttribute("href", "/deductions");
    expect(sidebar().getByRole("link", { name: /account/i })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("provides a mobile quick navigation with the key views", () => {
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const dock = within(
      screen.getByRole("navigation", { name: /quick navigation/i }),
    );
    for (const [label, href] of [
      ["Home", "/"],
      ["Upload payslip", "/income/upload"],
      ["Deductions", "/deductions"],
      ["Results", "/results"],
      ["Compare", "/compare"],
    ] as const) {
      expect(dock.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("offers a skip-to-content link targeting the main landmark", () => {
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("opens the drawer from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithStore(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const toggle = screen.getByRole("button", { name: /open navigation/i });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(
      document.getElementById("app-drawer") as HTMLInputElement,
    ).toBeChecked();
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
      screen.getAllByText(/not an official sars application/i).length,
    ).toBeGreaterThan(0);
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

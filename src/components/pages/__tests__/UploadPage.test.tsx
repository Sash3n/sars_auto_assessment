import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import UploadPage from "@/components/pages/UploadPage";
import { renderWithStore } from "@/test/renderWithStore";
import { APP_DATA_STORAGE_KEY } from "@/lib/store/storage";

vi.mock("@/lib/extraction/llm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/extraction/llm")>();
  return {
    ...original,
    extractWithAnthropic: vi.fn().mockResolvedValue([
      {
        field: "paye",
        value: 6_000,
        confidence: 0.95,
        evidence: "PAYE 6 000.00",
        source: "llm",
      },
    ]),
  };
});

import { extractWithAnthropic } from "@/lib/extraction/llm";

const PAYSLIP_TEXT = `Acme Widgets Pty Ltd
Payslip for March 2025
Basic salary   30 000.00
PAYE           6 000.00`;

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

async function pasteAndAnalyse(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Pasted payslip text"));
  await user.paste(PAYSLIP_TEXT);
  await user.click(screen.getByRole("button", { name: /analyse text/i }));
}

describe("UploadPage", () => {
  it("analyses pasted text and shows suggestions with confidence badges", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);

    await pasteAndAnalyse(user);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Basic salary")).toBeInTheDocument();
    expect(within(table).getByText("R 30 000.00")).toBeInTheDocument();
    expect(within(table).getByText("R 6 000.00")).toBeInTheDocument();
    expect(within(table).getAllByText(/high \d+%/i).length).toBeGreaterThan(0);
  });

  it("saves included suggestions as a payslip", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);

    await pasteAndAnalyse(user);
    await user.click(screen.getByRole("button", { name: /add to payslips/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /payslip added/i,
    );
    const stored = JSON.parse(
      window.localStorage.getItem(APP_DATA_STORAGE_KEY) ?? "{}",
    );
    const payslips = stored.years["2025-26"].payslips;
    expect(payslips).toHaveLength(1);
    expect(payslips[0].basicSalary).toBe(30_000);
    expect(payslips[0].paye).toBe(6_000);
    expect(payslips[0].employer).toContain("Acme");
  });

  it("excludes rows the user unchecks", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);

    await pasteAndAnalyse(user);
    await user.click(screen.getByRole("checkbox", { name: /include paye/i }));
    await user.click(screen.getByRole("button", { name: /add to payslips/i }));

    const stored = JSON.parse(
      window.localStorage.getItem(APP_DATA_STORAGE_KEY) ?? "{}",
    );
    expect(stored.years["2025-26"].payslips[0].paye).toBe(0);
    expect(stored.years["2025-26"].payslips[0].basicSalary).toBe(30_000);
  });

  it("gates the cloud fallback behind explicit consent and a key", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);

    await pasteAndAnalyse(user);
    await user.click(
      screen.getByRole("button", { name: /try cloud extraction/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/api\.anthropic\.com/)).toBeInTheDocument();

    const send = within(dialog).getByRole("button", {
      name: /send to anthropic/i,
    });
    expect(send).toBeDisabled();

    await user.type(
      within(dialog).getByLabelText("Anthropic API key"),
      "sk-ant-test",
    );
    expect(send).toBeDisabled();

    await user.click(
      within(dialog).getByRole("checkbox", { name: /i consent/i }),
    );
    expect(send).toBeEnabled();

    await user.click(send);
    expect(extractWithAnthropic).toHaveBeenCalledWith(
      "sk-ant-test",
      expect.stringContaining("Basic salary"),
    );
    // On success the modal closes and the merged table remains.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("never calls the cloud without the consent flow", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);
    await pasteAndAnalyse(user);
    expect(extractWithAnthropic).not.toHaveBeenCalled();
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import UploadPage from "@/components/pages/UploadPage";
import { renderWithStore } from "@/test/renderWithStore";

vi.mock("@/lib/extraction/llm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/extraction/llm")>();
  return { ...original, extractWithGemini: vi.fn() };
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("UploadPage consent modal accessibility", () => {
  it("focuses the key field on open and closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithStore(<UploadPage />);

    await user.click(screen.getByLabelText("Pasted payslip text"));
    await user.paste("Basic salary 30 000.00");
    await user.click(screen.getByRole("button", { name: /analyse text/i }));
    await user.click(
      screen.getByRole("button", { name: /try cloud extraction/i }),
    );

    const keyInput = screen.getByLabelText("Gemini API key");
    expect(keyInput).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

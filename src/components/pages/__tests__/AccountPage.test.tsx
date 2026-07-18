import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import AccountPage from "@/components/pages/AccountPage";
import { renderWithStore } from "@/test/renderWithStore";

const mocks = vi.hoisted(() => ({
  configured: true,
  currentUser: null as { uid: string; email: string } | null,
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpWithEmail: vi.fn(),
  signOutUser: vi.fn(),
  saveToCloud: vi.fn(),
  loadFromCloud: vi.fn(),
}));

vi.mock("@/lib/firebase/config", () => ({
  isFirebaseConfigured: () => mocks.configured,
}));

vi.mock("@/lib/firebase/client", () => ({
  signInWithEmail: mocks.signInWithEmail,
  signInWithGoogle: mocks.signInWithGoogle,
  signUpWithEmail: mocks.signUpWithEmail,
  signOutUser: mocks.signOutUser,
  watchAuthState: async (onChange: (user: unknown) => void) => {
    onChange(mocks.currentUser);
    return () => {};
  },
}));

vi.mock("@/lib/firebase/sync", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/firebase/sync")>();
  return {
    ...original,
    saveToCloud: mocks.saveToCloud,
    loadFromCloud: mocks.loadFromCloud,
  };
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.currentUser = null;
});

describe("AccountPage", () => {
  it("explains local-only mode when Firebase is unconfigured", () => {
    mocks.configured = false;
    renderWithStore(<AccountPage />);
    expect(screen.getByText(/local-only mode/i)).toBeInTheDocument();
    expect(screen.getByText(/\.env\.local/)).toBeInTheDocument();
  });

  it("signs in with email and password", async () => {
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.type(await screen.findByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "a-strong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(mocks.signInWithEmail).toHaveBeenCalledWith(
      "me@example.com",
      "a-strong-password",
    );
  });

  it("rejects a short password before calling Firebase", async () => {
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.type(await screen.findByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(mocks.signInWithEmail).not.toHaveBeenCalled();
  });

  it("signs in with Google", async () => {
    mocks.signInWithGoogle.mockResolvedValue({
      uid: "uid-1",
      email: "me@example.com",
    });
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.click(
      await screen.findByRole("button", { name: /continue with google/i }),
    );

    expect(mocks.signInWithGoogle).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/signed in/i);
  });

  it("shows a friendly message when the Google popup is closed", async () => {
    mocks.signInWithGoogle.mockRejectedValue({
      code: "auth/popup-closed-by-user",
    });
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.click(
      await screen.findByRole("button", { name: /continue with google/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled/i);
  });

  it("saves encrypted data to the cloud when signed in", async () => {
    mocks.currentUser = { uid: "uid-1", email: "me@example.com" };
    mocks.saveToCloud.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    expect(
      await screen.findByText(/unrecoverable/i),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Encryption passphrase"),
      "correct horse battery",
    );
    await user.click(screen.getByRole("button", { name: /save to cloud/i }));

    await waitFor(() =>
      expect(mocks.saveToCloud).toHaveBeenCalledWith(
        "uid-1",
        expect.objectContaining({ schemaVersion: 1 }),
        "correct horse battery",
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/encrypted/i);
  });

  it("requires a passphrase before saving", async () => {
    mocks.currentUser = { uid: "uid-1", email: "me@example.com" };
    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.click(
      await screen.findByRole("button", { name: /save to cloud/i }),
    );
    expect(mocks.saveToCloud).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/passphrase/i);
  });

  it("loads cloud data into the store", async () => {
    mocks.currentUser = { uid: "uid-1", email: "me@example.com" };
    const { emptyAppData } = await import("@/lib/model/defaults");
    const incoming = emptyAppData();
    incoming.years["2025-26"].localInterest = 12_345;
    mocks.loadFromCloud.mockResolvedValue(incoming);

    const user = userEvent.setup();
    renderWithStore(<AccountPage />);

    await user.type(
      await screen.findByLabelText("Encryption passphrase"),
      "correct horse battery",
    );
    await user.click(screen.getByRole("button", { name: /load from cloud/i }));

    await waitFor(() =>
      expect(mocks.loadFromCloud).toHaveBeenCalledWith(
        "uid-1",
        "correct horse battery",
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/loaded/i);
    // The hydrated store persists to localStorage.
    const stored = JSON.parse(
      window.localStorage.getItem("sars-app-data-v1") ?? "{}",
    );
    expect(stored.years["2025-26"].localInterest).toBe(12_345);
  });
});

// Type-only usage keeps the User import intentional in this suite.
void (null as unknown as User);

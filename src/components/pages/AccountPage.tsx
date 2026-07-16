"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  watchAuthState,
} from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { loadFromCloud, saveToCloud, SyncError } from "@/lib/firebase/sync";
import { DecryptionError } from "@/lib/crypto/encryption";
import { useStore } from "@/lib/store/StoreProvider";

const MIN_PASSWORD_LENGTH = 8;
const MIN_PASSPHRASE_LENGTH = 8;

/*
 * Errors shown to the user stay generic on purpose; the console keeps the
 * detail. Firebase error codes that users can act on get a friendly line.
 */
function friendlyAuthError(cause: unknown): string {
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code: string }).code)
      : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "Sign in failed. Check the email and password.";
  }
  if (code.includes("email-already-in-use")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (code.includes("weak-password")) {
    return "That password is too weak. Use at least 8 characters.";
  }
  if (code.includes("invalid-email")) {
    return "That email address does not look valid.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "Google sign-in was cancelled.";
  }
  if (code.includes("popup-blocked")) {
    return "The sign-in popup was blocked. Allow popups for this site and try again.";
  }
  if (code.includes("account-exists-with-different-credential")) {
    return "An account already exists with this email using a different sign-in method.";
  }
  return "Something went wrong. Try again.";
}

export default function AccountPage() {
  const { state, dispatch } = useStore();
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void watchAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    }).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        unsubscribe = stop;
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [configured]);

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        setNotice("Account created and signed in.");
      } else {
        await signInWithEmail(email, password);
        setNotice("Signed in.");
      }
      setPassword("");
    } catch (cause) {
      console.error("Auth error", cause);
      setError(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      setNotice("Signed in.");
    } catch (cause) {
      console.error("Google auth error", cause);
      setError(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setError(null);
    setNotice(null);
    if (!user) {
      return;
    }
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError("Use an encryption passphrase of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await saveToCloud(user.uid, state, passphrase);
      setNotice(
        "Saved. The data was encrypted on this device before it left your browser.",
      );
    } catch (cause) {
      console.error("Save error", cause);
      setError(
        cause instanceof SyncError
          ? cause.message
          : "Saving to the cloud failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad() {
    setError(null);
    setNotice(null);
    if (!user) {
      return;
    }
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError("Enter the encryption passphrase used when saving.");
      return;
    }
    setBusy(true);
    try {
      const data = await loadFromCloud(user.uid, passphrase);
      if (data === null) {
        setNotice("No cloud data found for this account yet.");
      } else {
        dispatch({ type: "hydrate", data });
        setNotice("Loaded. Cloud data replaced the local data on this device.");
      }
    } catch (cause) {
      console.error("Load error", cause);
      setError(
        cause instanceof DecryptionError || cause instanceof SyncError
          ? cause.message
          : "Loading from the cloud failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account and sync</h2>
        <p className="mt-1 text-sm opacity-70">
          The app is fully usable without an account: everything stays in this
          browser. An account only adds encrypted cloud backup and sync.
        </p>
      </div>

      {!configured ? (
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Local-only mode</h3>
            <p className="text-sm leading-relaxed opacity-80">
              Firebase is not configured in this environment, so cloud sync is
              unavailable and your data lives only in this browser&apos;s
              storage.
              To enable sync against the existing{" "}
              <span className="font-mono">sars-auto-assessment</span> Firebase
              project, copy <span className="font-mono">.env.example</span> to{" "}
              <span className="font-mono">.env.local</span>, fill in the web
              app values from the Firebase console, and restart the dev
              server. The Firestore security rules to deploy are in{" "}
              <span className="font-mono">firestore.rules</span>.
            </p>
          </div>
        </section>
      ) : !authReady ? (
        <p className="text-sm opacity-70">Checking sign-in state...</p>
      ) : user ? (
        <>
          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="card-title text-base">Signed in</h3>
                  <p className="text-sm opacity-70">{user.email}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    void signOutUser();
                    setNotice(null);
                    setError(null);
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <h3 className="card-title text-base">Encrypted cloud sync</h3>
              <div className="space-y-2 text-sm leading-relaxed opacity-80">
                <p>
                  Before anything is uploaded, your data is encrypted on this
                  device with a key derived from the passphrase below. The
                  passphrase itself never leaves this device and is never
                  stored anywhere: not in the cloud, not on disk.
                </p>
                <p className="font-semibold">
                  If you lose the passphrase, the cloud copy is unrecoverable.
                  Nobody can reset it, not you, not us, not Firebase. That is
                  the point of the design: nobody but you can read your
                  financial data.
                </p>
              </div>
              <label className="form-control w-full max-w-md">
                <span className="label-caps mb-1 block opacity-70">
                  Encryption passphrase
                </span>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={passphrase}
                  aria-label="Encryption passphrase"
                  placeholder="At least 8 characters"
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void handleSave()}
                >
                  Save to cloud
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => void handleLoad()}
                >
                  Load from cloud
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="card max-w-md border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div role="tablist" className="tabs-boxed tabs w-fit">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={`tab ${mode === "signin" ? "tab-active" : ""}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`tab ${mode === "signup" ? "tab-active" : ""}`}
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline w-full"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
            >
              Continue with Google
            </button>
            <div className="divider text-xs opacity-60">or</div>
            <form
              className="space-y-3"
              onSubmit={(event) => void handleAuthSubmit(event)}
            >
              <label className="form-control w-full">
                <span className="label-caps mb-1 block opacity-70">Email</span>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  required
                  aria-label="Email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="form-control w-full">
                <span className="label-caps mb-1 block opacity-70">
                  Password
                </span>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={password}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  aria-label="Password"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={busy}
              >
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
          </div>
        </section>
      )}

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="alert alert-success">
          <span>{notice}</span>
        </div>
      ) : null}
    </div>
  );
}

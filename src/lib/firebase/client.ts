import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { readFirebaseConfig } from "./config";

/*
 * Lazy Firebase bootstrap. The SDK modules load only when a signed-in flow
 * actually starts, keeping the default bundle lean and the app fully
 * functional with Firebase unconfigured.
 */

let appPromise: Promise<FirebaseApp> | null = null;

async function getApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = (async () => {
      const config = readFirebaseConfig();
      if (!config) {
        throw new Error(
          "Firebase is not configured. Copy .env.example to .env.local and fill in the project values.",
        );
      }
      const { initializeApp, getApps } = await import("firebase/app");
      const existing = getApps();
      return existing.length > 0 ? existing[0] : initializeApp(config);
    })();
  }
  return appPromise;
}

export async function getFirebaseAuth(): Promise<Auth> {
  const app = await getApp();
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

export async function getFirestoreDb(): Promise<Firestore> {
  const app = await getApp();
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(app);
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const auth = await getFirebaseAuth();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return credential.user;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  const auth = await getFirebaseAuth();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

export async function watchAuthState(
  onChange: (user: User | null) => void,
): Promise<() => void> {
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(auth, onChange);
}

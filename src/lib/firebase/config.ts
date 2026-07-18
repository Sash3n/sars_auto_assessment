/*
 * Firebase configuration comes exclusively from environment variables, per
 * the project's secrets convention: nothing is committed, .env.local holds
 * the real values (see .env.example and the README). Every feature stays
 * fully usable with Firebase unconfigured; cloud sync is strictly optional.
 *
 * The existing Firebase project is `sars-auto-assessment`. This code
 * configures against it, it does not create anything.
 */

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function readFirebaseConfig(): FirebaseEnvConfig | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  if (!config.apiKey || !config.projectId || !config.appId) {
    return null;
  }
  return config;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

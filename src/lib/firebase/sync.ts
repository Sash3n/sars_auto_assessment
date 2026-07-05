import type { AppData } from "@/lib/model/types";
import {
  decryptJson,
  encryptJson,
  type EncryptedEnvelope,
} from "@/lib/crypto/encryption";
import { getFirestoreDb } from "./client";

/*
 * Cloud sync stores one encrypted blob per user at
 * users/{uid}/private/appData. The whole data tree is encrypted client-side
 * before write: Firestore only ever holds ciphertext, and the security
 * rules restrict the document to its owner. The plaintext never leaves the
 * browser.
 */

/** Firestore documents cap at 1 MiB; leave headroom for metadata. */
export const MAX_ENCRYPTED_BYTES = 900_000;

export interface CloudDocument {
  v: number;
  envelope: EncryptedEnvelope;
  updatedAt: string;
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

/** Pure assembly step, unit tested without Firestore. */
export async function buildCloudDocument(
  data: AppData,
  passphrase: string,
): Promise<CloudDocument> {
  const envelope = await encryptJson(data, passphrase);
  const size = envelope.data.length;
  if (size > MAX_ENCRYPTED_BYTES) {
    throw new SyncError(
      "The encrypted data is too large for a single cloud document. Remove unused tax years and try again.",
    );
  }
  return {
    v: 1,
    envelope,
    updatedAt: new Date().toISOString(),
  };
}

/** Pure parse step, unit tested without Firestore. */
export async function readCloudDocument(
  document: unknown,
  passphrase: string,
): Promise<AppData> {
  if (
    typeof document !== "object" ||
    document === null ||
    (document as CloudDocument).v !== 1 ||
    typeof (document as CloudDocument).envelope !== "object"
  ) {
    throw new SyncError("The cloud document has an unknown format.");
  }
  const data = await decryptJson<AppData>(
    (document as CloudDocument).envelope,
    passphrase,
  );
  if (data.schemaVersion !== 1 || typeof data.years !== "object") {
    throw new SyncError("The decrypted data is not a known app data schema.");
  }
  return data;
}

export async function saveToCloud(
  uid: string,
  data: AppData,
  passphrase: string,
): Promise<void> {
  const payload = await buildCloudDocument(data, passphrase);
  const db = await getFirestoreDb();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "users", uid, "private", "appData"), payload);
}

export async function loadFromCloud(
  uid: string,
  passphrase: string,
): Promise<AppData | null> {
  const db = await getFirestoreDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const snapshot = await getDoc(doc(db, "users", uid, "private", "appData"));
  if (!snapshot.exists()) {
    return null;
  }
  return readCloudDocument(snapshot.data(), passphrase);
}

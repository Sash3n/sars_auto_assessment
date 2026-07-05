/*
 * Client-side encryption for everything sensitive that leaves the device.
 * The key is derived from a passphrase only the user holds: Firestore and
 * the Firebase project owner only ever see ciphertext. If the passphrase is
 * lost the data is unrecoverable, by design, and the UI says so plainly.
 *
 * Scheme: PBKDF2 (SHA-256, 310 000 iterations, random 16-byte salt) derives
 * an AES-GCM 256 key. Each encryption uses a fresh random 12-byte IV. GCM
 * authenticates the ciphertext, so tampering fails decryption outright.
 */

export const ENVELOPE_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedEnvelope {
  v: number;
  /** Base64 PBKDF2 salt. */
  salt: string;
  /** Base64 AES-GCM IV. */
  iv: string;
  /** Base64 ciphertext. */
  data: string;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/** Encrypt any JSON-serialisable value under the passphrase. */
export async function encryptJson(
  value: unknown,
  passphrase: string,
): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) {
    throw new Error("The passphrase must be at least 8 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return {
    v: ENVELOPE_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext),
  };
}

/** Decrypt an envelope. Throws DecryptionError on a wrong passphrase or tampering. */
export async function decryptJson<T>(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<T> {
  if (envelope.v !== ENVELOPE_VERSION) {
    throw new DecryptionError(
      `Unsupported envelope version ${envelope.v}. Update the app.`,
    );
  }
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource,
    );
  } catch {
    throw new DecryptionError(
      "Decryption failed. The passphrase is wrong or the data was altered.",
    );
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

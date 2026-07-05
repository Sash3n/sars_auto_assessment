import { describe, expect, it } from "vitest";
import {
  decryptJson,
  DecryptionError,
  encryptJson,
  ENVELOPE_VERSION,
} from "@/lib/crypto/encryption";

describe("encryptJson and decryptJson", () => {
  it("round-trips structured data", async () => {
    const value = {
      payslips: [{ employer: "Acme", basicSalary: 30_000.55 }],
      note: "unicode: R 12 450,50 en dankie",
    };
    const envelope = await encryptJson(value, "correct horse battery");
    const decrypted = await decryptJson<typeof value>(
      envelope,
      "correct horse battery",
    );
    expect(decrypted).toEqual(value);
  });

  it("produces ciphertext, not plaintext", async () => {
    const envelope = await encryptJson(
      { secret: "employer Acme salary 30000" },
      "correct horse battery",
    );
    expect(envelope.v).toBe(ENVELOPE_VERSION);
    expect(envelope.data).not.toContain("Acme");
    expect(atob(envelope.data)).not.toContain("Acme");
  });

  it("uses a fresh salt and IV every time", async () => {
    const first = await encryptJson({ a: 1 }, "correct horse battery");
    const second = await encryptJson({ a: 1 }, "correct horse battery");
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it("rejects a wrong passphrase", async () => {
    const envelope = await encryptJson({ a: 1 }, "correct horse battery");
    await expect(
      decryptJson(envelope, "wrong horse battery"),
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it("rejects tampered ciphertext", async () => {
    const envelope = await encryptJson({ a: 1 }, "correct horse battery");
    const bytes = Uint8Array.from(atob(envelope.data), (c) => c.charCodeAt(0));
    bytes[0] = bytes[0] ^ 0xff;
    const tampered = {
      ...envelope,
      data: btoa(String.fromCharCode(...bytes)),
    };
    await expect(
      decryptJson(tampered, "correct horse battery"),
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it("rejects unknown envelope versions", async () => {
    const envelope = await encryptJson({ a: 1 }, "correct horse battery");
    await expect(
      decryptJson({ ...envelope, v: 99 }, "correct horse battery"),
    ).rejects.toThrow(/version/i);
  });

  it("refuses a short passphrase", async () => {
    await expect(encryptJson({ a: 1 }, "short")).rejects.toThrow(
      /at least 8 characters/i,
    );
  });
});

import { describe, expect, it } from "vitest";
import { emptyAppData, emptyPayslip } from "@/lib/model/defaults";
import {
  buildCloudDocument,
  readCloudDocument,
  SyncError,
} from "@/lib/firebase/sync";

describe("cloud document round trip", () => {
  it("encrypts app data into a versioned document and reads it back", async () => {
    const data = emptyAppData();
    data.years["2025-26"].payslips.push({
      ...emptyPayslip("2025-03"),
      employer: "Acme",
      basicSalary: 30_000,
    });

    const document = await buildCloudDocument(data, "correct horse battery");
    expect(document.v).toBe(1);
    expect(document.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(document)).not.toContain("Acme");

    const restored = await readCloudDocument(
      document,
      "correct horse battery",
    );
    expect(restored.years["2025-26"].payslips[0].employer).toBe("Acme");
  });

  it("rejects an unknown document shape", async () => {
    await expect(
      readCloudDocument({ v: 2 }, "correct horse battery"),
    ).rejects.toBeInstanceOf(SyncError);
    await expect(
      readCloudDocument(null, "correct horse battery"),
    ).rejects.toBeInstanceOf(SyncError);
  });

  it("rejects decrypted content that is not app data", async () => {
    const bogus = await buildCloudDocument(
      { schemaVersion: 1, activeTaxYearId: "x", years: {} },
      "correct horse battery",
    );
    // Valid app data passes; break the inner schema to test the guard.
    const broken = await import("@/lib/crypto/encryption").then((m) =>
      m.encryptJson({ nonsense: true }, "correct horse battery"),
    );
    await expect(
      readCloudDocument(
        { v: 1, envelope: broken, updatedAt: bogus.updatedAt },
        "correct horse battery",
      ),
    ).rejects.toThrow(/not a known app data schema/i);
  });
});

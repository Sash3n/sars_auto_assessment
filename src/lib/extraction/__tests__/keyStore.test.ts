import { afterEach, describe, expect, it } from "vitest";
import {
  API_KEY_STORAGE_KEY,
  clearApiKey,
  loadApiKey,
  saveApiKey,
} from "@/lib/extraction/keyStore";

afterEach(() => {
  window.localStorage.clear();
});

describe("keyStore", () => {
  it("round-trips a key, trimmed", () => {
    saveApiKey("  sk-ant-test  ");
    expect(loadApiKey()).toBe("sk-ant-test");
    expect(window.localStorage.getItem(API_KEY_STORAGE_KEY)).toBe("sk-ant-test");
  });

  it("returns empty when nothing is stored", () => {
    expect(loadApiKey()).toBe("");
  });

  it("clears the key", () => {
    saveApiKey("sk-ant-test");
    clearApiKey();
    expect(loadApiKey()).toBe("");
    expect(window.localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });
});

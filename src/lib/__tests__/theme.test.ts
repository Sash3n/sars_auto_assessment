import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getAppliedTheme,
  getStoredTheme,
  getSystemTheme,
  isTheme,
  persistTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function clearThemeState() {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
}

afterEach(() => {
  clearThemeState();
  vi.restoreAllMocks();
});

describe("isTheme", () => {
  it("accepts only the two known themes", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("solarized")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("getStoredTheme", () => {
  it("returns a stored valid theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(getStoredTheme()).toBeNull();
  });

  it("returns null when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getStoredTheme()).toBeNull();
  });
});

describe("getSystemTheme", () => {
  it("returns dark when the media query matches", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    expect(getSystemTheme()).toBe("dark");
  });

  it("returns light otherwise", () => {
    expect(getSystemTheme()).toBe("light");
  });
});

describe("applyTheme and getAppliedTheme", () => {
  it("round-trips through the html data-theme attribute", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(getAppliedTheme()).toBe("dark");
  });

  it("returns null when no valid theme is applied", () => {
    document.documentElement.setAttribute("data-theme", "banana");
    expect(getAppliedTheme()).toBeNull();
  });
});

describe("persistTheme", () => {
  it("stores the choice", () => {
    persistTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("swallows storage failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => persistTheme("light")).not.toThrow();
  });
});

describe("resolveInitialTheme", () => {
  it("prefers the already-applied theme set by the pre-paint script", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("falls back to the stored theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("falls back to the system preference last", () => {
    expect(resolveInitialTheme()).toBe("light");
  });
});

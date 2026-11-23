import { describe, it, expect } from "vitest";
import { getFirebaseConfig, getApiBaseUrl } from "./config.js";

const complete = {
  VITE_FIREBASE_API_KEY: "AIza-test-key",
  VITE_FIREBASE_AUTH_DOMAIN: "automatizacion-inventario-2504.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "automatizacion-inventario-2504",
  VITE_API_BASE_URL: "http://localhost:4000",
};

describe("getFirebaseConfig", () => {
  it("returns the client SDK config from VITE_ variables", () => {
    expect(getFirebaseConfig(complete)).toEqual({
      apiKey: "AIza-test-key",
      authDomain: "automatizacion-inventario-2504.firebaseapp.com",
      projectId: "automatizacion-inventario-2504",
    });
  });

  it("throws a coded error listing every missing required variable", () => {
    expect(() => getFirebaseConfig({})).toThrowError(
      /VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID/
    );
    try {
      getFirebaseConfig({ VITE_FIREBASE_API_KEY: "k" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error.code).toBe("missing_firebase_config");
      expect(error.message).not.toMatch(/VITE_FIREBASE_API_KEY/);
    }
  });

  it("treats blank strings as missing", () => {
    expect(() =>
      getFirebaseConfig({ ...complete, VITE_FIREBASE_PROJECT_ID: "  " })
    ).toThrowError(/VITE_FIREBASE_PROJECT_ID/);
  });
});

describe("getApiBaseUrl", () => {
  it("uses VITE_API_BASE_URL when present", () => {
    expect(getApiBaseUrl(complete)).toBe("http://localhost:4000");
  });

  it("falls back to the backend default port when unset", () => {
    expect(getApiBaseUrl({})).toBe("http://localhost:4000");
  });
});

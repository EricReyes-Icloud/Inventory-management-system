import { afterEach, describe, expect, it, vi } from "vitest";

const ENV = {
  VITE_FIREBASE_API_KEY: "AIza-test",
  VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "example",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("firebase module", () => {
  it("initializes exactly one app and exports auth", async () => {
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);

    const { default: app, auth } = await import("./firebase.js");
    const { getApps, getApp } = await import("firebase/app");

    expect(getApps()).toHaveLength(1);
    expect(app).toBe(getApp());
    expect(auth).toBeDefined();
    expect(app.options.projectId).toBe("example");

    // Re-importing reuses the instance (HMR guard).
    vi.resetModules();
    const again = await import("./firebase.js");
    expect(again.default).toBe(app);
  });
});

describe("api module", () => {
  it("posts the ID token to the backend and returns the parsed result", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:4000/");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: "session", passwordChangeRequired: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { loginWithIdToken } = await import("./api.js");
    const result = await loginWithIdToken("id-token-123");

    expect(result).toEqual({ token: "session", passwordChangeRequired: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "id-token-123" }),
    });
  });

  it("throws a coded error with the backend error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_token" }),
      }))
    );

    const { loginWithIdToken } = await import("./api.js");
    await expect(loginWithIdToken("bad")).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });
});

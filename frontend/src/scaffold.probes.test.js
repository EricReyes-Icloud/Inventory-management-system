// Verifier probes for S3 config + api + firebase client contract.
import { describe, expect, it, vi, afterEach } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("getFirebaseConfig", () => {
  it("lists all three vars when env is empty", async () => {
    const { getFirebaseConfig } = await import("./config.js");
    let err;
    try { getFirebaseConfig({}); } catch (e) { err = e; }
    expect(err.code).toBe("missing_firebase_config");
    expect(err.message).toBe("Missing Firebase client config: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID");
  });

  it("lists only the actually missing var (single)", async () => {
    const { getFirebaseConfig } = await import("./config.js");
    let err;
    try {
      getFirebaseConfig({ VITE_FIREBASE_API_KEY: "k", VITE_FIREBASE_AUTH_DOMAIN: "d" });
    } catch (e) { err = e; }
    expect(err.message).toBe("Missing Firebase client config: VITE_FIREBASE_PROJECT_ID");
  });

  it("treats undefined/null/whitespace/non-string as missing", async () => {
    const { getFirebaseConfig } = await import("./config.js");
    const cases = [
      { VITE_FIREBASE_API_KEY: undefined, VITE_FIREBASE_AUTH_DOMAIN: "d", VITE_FIREBASE_PROJECT_ID: "p" },
      { VITE_FIREBASE_API_KEY: null, VITE_FIREBASE_AUTH_DOMAIN: "d", VITE_FIREBASE_PROJECT_ID: "p" },
      { VITE_FIREBASE_API_KEY: "   ", VITE_FIREBASE_AUTH_DOMAIN: "d", VITE_FIREBASE_PROJECT_ID: "p" },
      { VITE_FIREBASE_API_KEY: 1234, VITE_FIREBASE_AUTH_DOMAIN: "d", VITE_FIREBASE_PROJECT_ID: "p" },
    ];
    for (const env of cases) {
      let err;
      try { getFirebaseConfig(env); } catch (e) { err = e; }
      expect(err?.message).toBe("Missing Firebase client config: VITE_FIREBASE_API_KEY");
    }
  });

  it("trims values", async () => {
    const { getFirebaseConfig } = await import("./config.js");
    expect(getFirebaseConfig({ VITE_FIREBASE_API_KEY: " k ", VITE_FIREBASE_AUTH_DOMAIN: " d ", VITE_FIREBASE_PROJECT_ID: " p " }))
      .toEqual({ apiKey: "k", authDomain: "d", projectId: "p" });
  });
});

describe("getApiBaseUrl", () => {
  it("defaults to the backend default port 4000", async () => {
    const { getApiBaseUrl } = await import("./config.js");
    expect(getApiBaseUrl({})).toBe("http://localhost:4000");
    expect(getApiBaseUrl({ VITE_API_BASE_URL: "  " })).toBe("http://localhost:4000");
  });

  it("strips trailing slashes", async () => {
    const { getApiBaseUrl } = await import("./config.js");
    expect(getApiBaseUrl({ VITE_API_BASE_URL: "https://api.example.com///" })).toBe("https://api.example.com");
  });
});

describe("api.loginWithIdToken", () => {
  it("POSTs {idToken} to /api/auth/login on the configured base", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:4000");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ token: "t", admin: { uid: "u" }, passwordChangeRequired: false }) }));
    vi.stubGlobal("fetch", fetchMock);
    const { loginWithIdToken } = await import("./api.js");
    const r = await loginWithIdToken("tok");
    expect(r).toEqual({ token: "t", admin: { uid: "u" }, passwordChangeRequired: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ idToken: "tok" });
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("maps {error} body to a coded error, preserving status", async () => {
    for (const [status, code] of [[401, "invalid_token"], [403, "not_admin"], [429, "too_many_requests"], [500, "internal_error"]]) {
      vi.resetModules();
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => ({ error: code }) })));
      const { loginWithIdToken } = await import("./api.js");
      let err;
      try { await loginWithIdToken("x"); } catch (e) { err = e; }
      expect(err.code).toBe(code);
      expect(err.status).toBe(status);
      expect(err.message).toBe(code);
    }
  });

  it("maps non-JSON error body to http_<status>", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError("bad json"); } })));
    const { loginWithIdToken } = await import("./api.js");
    let err;
    try { await loginWithIdToken("x"); } catch (e) { err = e; }
    expect(err.code).toBe("http_502");
    expect(err.message).toBe("login_failed_502");
    expect(err.status).toBe(502);
  });

  it("propagates a network failure instead of swallowing it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { loginWithIdToken } = await import("./api.js");
    await expect(loginWithIdToken("x")).rejects.toThrow(/Failed to fetch/);
  });

  it("200 with a non-JSON body throws a coded error instead of resolving null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } })));
    const { loginWithIdToken } = await import("./api.js");
    await expect(loginWithIdToken("x")).rejects.toMatchObject({ code: "http_200", status: 200 });
  });
});

describe("firebase.js", () => {
  const ENV = { VITE_FIREBASE_API_KEY: "AIza-probe", VITE_FIREBASE_AUTH_DOMAIN: "probe.firebaseapp.com", VITE_FIREBASE_PROJECT_ID: "probe-project" };

  it("initializes exactly one app across repeated imports", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const first = await import("./firebase.js");
    const second = await import("./firebase.js");
    vi.resetModules();
    const third = await import("./firebase.js");
    const { getApps } = await import("firebase/app");
    expect(getApps()).toHaveLength(1);
    expect(second.default).toBe(first.default);
    expect(third.default).toBe(first.default);
    expect(first.auth).toBeDefined();
    expect(first.default.options.projectId).toBe("probe-project");
  });

  it("fails fast with a coded error when Firebase env is missing", async () => {
    let err;
    try { await import("./firebase.js"); } catch (e) { err = e; }
    expect(err?.code).toBe("missing_firebase_config");
  });
});

describe("api error mapping for the real backend codes", () => {
  it("maps every backend auth error code exactly", async () => {
    const real = [[400, "invalid_request"], [401, "invalid_token"], [403, "admin_not_found"], [429, "too_many_requests"], [500, "internal_error"]];
    for (const [status, code] of real) {
      vi.resetModules();
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => ({ error: code }) })));
      const { loginWithIdToken } = await import("./api.js");
      let err;
      try { await loginWithIdToken("x"); } catch (e) { err = e; }
      expect([err.code, err.status, err.message]).toEqual([code, status, code]);
    }
  });
});

// Verifier probes: minimal routing setup and PWA/manifest consistency for S3.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // frontend/
const read = (p) => readFileSync(path.join(root, p), "utf8");

function renderAt(pathname) {
  const router = createMemoryRouter([{ path: "*", element: React.createElement(App) }], { initialEntries: [pathname] });
  const html = renderToString(React.createElement(RouterProvider, { router }));
  return { html, router, location: router.state.location.pathname };
}

describe("routing", () => {
  it("/login renders the Login page", () => {
    expect(renderAt("/login").html).toContain("Login");
  });
  it("/ renders the Dashboard placeholder", () => {
    expect(renderAt("/").html).toContain("Dashboard");
  });
  // No DOM environment is installed, so the Navigate effect cannot run here;
  // the redirect is asserted statically plus the absence of a dashboard leak.
  it("unknown path /nope resolves to the wildcard redirect route", () => {
    const { html } = renderAt("/nope");
    expect(html).not.toContain("Dashboard");
    expect(html).not.toContain("Login");
    expect(read("src/App.jsx")).toContain('<Route path="*" element={<Navigate to="/login" replace />} />');
  });
});

describe("PWA wiring", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  const indexHtml = read("index.html");
  const mainJsx = read("src/main.jsx");

  it("manifest is well formed with a standalone display and an in-app start_url", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/login");
    expect(manifest.theme_color).toBe("#1b5e20");
    expect(manifest.background_color).toBeTruthy();
  });

  it("every declared icon exists on disk", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(root, "public", icon.src.replace(/^\//, ""))), icon.src).toBe(true);
    }
  });

  it("index.html links the manifest and the icons", () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/icon.svg" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#1b5e20" />');
  });

  it("start_url resolves through the router (/login is a declared route)", () => {
    expect(read("src/App.jsx")).toContain('path="/login"');
  });

  it("service worker registration is gated on import.meta.env.PROD", () => {
    const lines = mainJsx.split("\n");
    const guardIdx = lines.findIndex((l) => l.includes('"serviceWorker" in navigator'));
    expect(guardIdx).toBeGreaterThan(-1);
    expect(lines[guardIdx]).toContain("import.meta.env.PROD");
    const registerIdx = lines.findIndex((l) => l.includes('register("/sw.js")'));
    expect(registerIdx).toBeGreaterThan(guardIdx);
    // Nothing registers outside the guard.
    expect((mainJsx.match(/\.register\(/g) || [])).toHaveLength(1);
    expect(mainJsx.indexOf(".register(")).toBeGreaterThan(mainJsx.indexOf("import.meta.env.PROD"));
  });

});

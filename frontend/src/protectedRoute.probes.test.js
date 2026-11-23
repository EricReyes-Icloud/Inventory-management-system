// SSR probes for the S5 route guard. The Node environment has no DOM, so the
// effect-driven verification itself is covered by sessionCheck.test.js; these
// probes pin the public route contract and the initial guarded view.
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

vi.hoisted(() => {
  process.env.VITE_FIREBASE_API_KEY ||= "AIza-probe";
  process.env.VITE_FIREBASE_AUTH_DOMAIN ||= "probe.firebaseapp.com";
  process.env.VITE_FIREBASE_PROJECT_ID ||= "probe-project";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function renderAt(pathname) {
  return import("./App.jsx").then(({ default: App }) => {
    const router = createMemoryRouter(
      [{ path: "*", element: React.createElement(App) }],
      { initialEntries: [pathname] }
    );
    return {
      html: renderToString(React.createElement(RouterProvider, { router })),
      pathname: router.state.location.pathname,
    };
  });
}

describe("protected route contract", () => {
  it("/ shows the checking view on the server and never exposes the dashboard", async () => {
    const { html } = await renderAt("/");
    expect(html).toMatch(/verificando sesión/i);
    expect(html).not.toContain("Dashboard");
  });

  it("/login stays public and renders the sign-in form", async () => {
    const { html } = await renderAt("/login");
    expect(html).toMatch(/Iniciar sesión/i);
    expect(html).toContain('type="password"');
    expect(html).not.toMatch(/verificando sesión/i);
  });

  it("an unknown path keeps the static redirect route to /login", async () => {
    const { html } = await renderAt("/nope");
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    expect(readFileSync(path.join(root, "src/App.jsx"), "utf8")).toContain(
      '<Route path="*" element={<Navigate to="/login" replace />} />'
    );
    expect(html).not.toContain("Dashboard");
  });

  it("the guarded route checks the ID token through verifyAdminSession", async () => {
    const api = await import("./api.js");
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const source = readFileSync(path.join(root, "src/components/ProtectedRoute.jsx"), "utf8");

    expect(typeof api.verifyAdminSession).toBe("function");
    expect(source).toContain("verifyAdminSession");
    expect(source).toContain("onAuthStateChanged");
    expect(source).toMatch(/getIdToken\(\)/);
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  });
});

// Render probes for S4. Node environment: renderToStaticMarkup verifies the
// public form contract without a DOM; submit behavior is covered in loginFlow.test.js.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

const ENV = {
  VITE_FIREBASE_API_KEY: "AIza-probe",
  VITE_FIREBASE_AUTH_DOMAIN: "probe.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "probe-project",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderLogin() {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  const { default: LoginPage } = await import("./pages/Login.jsx");
  const router = createMemoryRouter(
    [{ path: "/login", element: createElement(LoginPage) }],
    { initialEntries: ["/login"] }
  );
  return renderToString(createElement(RouterProvider, { router }));
}

describe("Login page markup", () => {
  it("renders a sign-in heading and a form", async () => {
    const html = await renderLogin();
    expect(html).toMatch(/Iniciar sesión/i);
    expect(html).toContain("<form");
  });

  it("exposes an email field with the correct type and autocomplete", async () => {
    const html = await renderLogin();
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/name="email"/);
    expect(html).toMatch(/autocomplete="username"/i);
    expect(html).toMatch(/required=""/);
  });

  it("exposes a password field that never renders its value", async () => {
    const html = await renderLogin();
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/name="password"/);
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).not.toMatch(/value="[^"]+"/);
  });

  it("renders a submit button", async () => {
    const html = await renderLogin();
    expect(html).toMatch(/type="submit"/);
    expect(html).toMatch(/Ingresar/i);
  });

  it("starts with no error and no password-change notice", async () => {
    const html = await renderLogin();
    expect(html).not.toMatch(/role="alert"/);
    expect(html).not.toMatch(/contraseña temporal/i);
  });

  it("never embeds a token or credential in the initial markup", async () => {
    const html = await renderLogin();
    expect(html).not.toMatch(/id-token|passwordChangeRequired|firebase/i);
  });
});

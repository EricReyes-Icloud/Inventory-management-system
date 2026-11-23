import { describe, expect, it, vi } from "vitest";

function makeDeps(overrides = {}) {
  const credential = {
    user: { getIdToken: vi.fn(async () => "id-token-123") },
  };
  const deps = {
    auth: { name: "auth-instance" },
    credential,
    signIn: vi.fn(async () => credential),
    exchange: vi.fn(async () => ({
      token: "id-token-123",
      admin: { uid: "uid-1", email: "admin@colibri.test", nombre: "Admin" },
      passwordChangeRequired: true,
    })),
    ...overrides,
  };
  return deps;
}

async function callLogin(overrides = {}) {
  const deps = makeDeps(overrides);
  const { runLogin } = await import("./loginFlow.js");
  const result = await runLogin({
    email: "admin@colibri.test",
    password: "secret-123",
    auth: deps.auth,
    signIn: deps.signIn,
    exchange: deps.exchange,
  });
  return { deps, result };
}

describe("runLogin", () => {
  it("signs in, exchanges a fresh ID token and returns the backend result", async () => {
    const { deps, result } = await callLogin();

    expect(deps.signIn).toHaveBeenCalledWith(
      deps.auth,
      "admin@colibri.test",
      "secret-123"
    );
    expect(deps.credential.user.getIdToken).toHaveBeenCalledTimes(1);
    expect(deps.exchange).toHaveBeenCalledWith("id-token-123");
    expect(result).toEqual({
      token: "id-token-123",
      admin: { uid: "uid-1", email: "admin@colibri.test", nombre: "Admin" },
      passwordChangeRequired: true,
    });
  });

  it("does not persist the token or the password anywhere", async () => {
    const { deps } = await callLogin();
    expect(deps.exchange).toHaveBeenCalledTimes(1);
    expect(deps.signIn.mock.calls[0][2]).toBe("secret-123");
    expect(JSON.stringify(deps.credential)).not.toContain("secret-123");
  });

  it("propagates a Firebase sign-in failure without calling the backend", async () => {
    const failure = Object.assign(new Error("bad credentials"), {
      code: "auth/invalid-credential",
    });
    const signIn = vi.fn(async () => {
      throw failure;
    });
    const deps = makeDeps({ signIn });
    const { runLogin } = await import("./loginFlow.js");

    await expect(
      runLogin({
        email: "a@b.test",
        password: "x",
        auth: deps.auth,
        signIn: deps.signIn,
        exchange: deps.exchange,
      })
    ).rejects.toBe(failure);
    expect(deps.exchange).not.toHaveBeenCalled();
  });

  it("propagates a backend rejection with its coded error intact", async () => {
    const failure = Object.assign(new Error("admin_not_found"), {
      code: "admin_not_found",
      status: 403,
    });
    const exchange = vi.fn(async () => {
      throw failure;
    });
    const deps = makeDeps({ exchange });
    const { runLogin } = await import("./loginFlow.js");

    await expect(
      runLogin({
        email: "a@b.test",
        password: "x",
        auth: deps.auth,
        signIn: deps.signIn,
        exchange: deps.exchange,
      })
    ).rejects.toBe(failure);
    expect(deps.credential.user.getIdToken).toHaveBeenCalledTimes(1);
  });
});

describe("describeLoginError", () => {
  const cases = [
    ["auth/invalid-email", /correo electrónico válido/i],
    ["auth/missing-password", /contraseña/i],
    ["auth/invalid-credential", /correo o contraseña incorrectos/i],
    ["auth/user-not-found", /correo o contraseña incorrectos/i],
    ["auth/wrong-password", /correo o contraseña incorrectos/i],
    ["auth/too-many-requests", /demasiados intentos/i],
    ["auth/network-request-failed", /conexión/i],
    ["auth/unauthorized-domain", /dominio/i],
    ["invalid_request", /solicitud/i],
    ["invalid_token", /sesión expiró/i],
    ["admin_not_found", /permisos de administrador/i],
    ["internal_error", /error del servidor/i],
    ["http_500", /error del servidor/i],
    ["too_many_requests", /demasiados intentos/i],
    ["http_429", /demasiados intentos/i],
    ["http_401", /sesión expiró/i],
    ["http_403", /permisos de administrador/i],
    ["http_200", /no se pudo iniciar sesión/i],
    ["something_unexpected", /no se pudo iniciar sesión/i],
  ];

  it.each(cases)("maps %s to a user-facing message", async (code, pattern) => {
    const { describeLoginError } = await import("./loginFlow.js");
    expect(describeLoginError(Object.assign(new Error("x"), { code }))).toMatch(
      pattern
    );
  });

  it("handles an error without a code and a null error", async () => {
    const { describeLoginError } = await import("./loginFlow.js");
    expect(describeLoginError(new Error("boom"))).toMatch(
      /no se pudo iniciar sesión/i
    );
    expect(describeLoginError(null)).toMatch(/no se pudo iniciar sesión/i);
  });
});

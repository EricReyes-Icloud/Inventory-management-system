import { describe, expect, it, vi } from "vitest";

function load() {
  return import("./sessionCheck.js");
}

function coded(code) {
  return Object.assign(new Error("backend said no"), { code });
}

const admin = { uid: "u-1", email: "admin@colibri.test", nombre: "Admin" };

describe("runSessionCheck", () => {
  it("verifies a fresh ID token and returns the admin", async () => {
    const { runSessionCheck } = await load();
    const verify = vi.fn(async () => admin);

    const result = await runSessionCheck({
      getToken: async () => "fresh-id-token",
      verify,
    });

    expect(verify).toHaveBeenCalledWith("fresh-id-token");
    expect(result).toEqual({ ok: true, admin });
  });

  it("does not call the backend when there is no current user", async () => {
    const { runSessionCheck } = await load();
    const verify = vi.fn(async () => admin);

    const result = await runSessionCheck({
      getToken: async () => null,
      verify,
    });

    expect(result).toEqual({ ok: false, reason: "not_authenticated" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("treats an empty or whitespace token as not authenticated", async () => {
    const { runSessionCheck } = await load();
    const verify = vi.fn(async () => admin);

    for (const token of ["", "   ", undefined]) {
      const result = await runSessionCheck({
        getToken: async () => token,
        verify,
      });
      expect(result.reason).toBe("not_authenticated");
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it.each(["invalid_token", "http_401"])(
    "maps %s to session_expired",
    async (code) => {
      const { runSessionCheck } = await load();
      const result = await runSessionCheck({
        getToken: async () => "token",
        verify: async () => {
          throw coded(code);
        },
      });
      expect(result).toEqual({ ok: false, reason: "session_expired" });
    }
  );

  it.each(["admin_not_found", "http_403"])(
    "maps %s to admin_not_found",
    async (code) => {
      const { runSessionCheck } = await load();
      const result = await runSessionCheck({
        getToken: async () => "token",
        verify: async () => {
          throw coded(code);
        },
      });
      expect(result).toEqual({ ok: false, reason: "admin_not_found" });
    }
  );

  it("maps an unknown failure to verification_failed without leaking its message", async () => {
    const { runSessionCheck } = await load();
    const result = await runSessionCheck({
      getToken: async () => "token",
      verify: async () => {
        throw new Error("Firestore internals: secret-connection-string");
      },
    });
    expect(result).toEqual({ ok: false, reason: "verification_failed" });
    expect(JSON.stringify(result)).not.toContain("secret-connection-string");
  });

  it("maps a Firebase token-refresh failure to session_expired", async () => {
    const { runSessionCheck } = await load();
    const verify = vi.fn(async () => admin);
    const result = await runSessionCheck({
      getToken: async () => {
        throw coded("auth/user-token-expired");
      },
      verify,
    });
    expect(result).toEqual({ ok: false, reason: "session_expired" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("never returns or stores the token in its result", async () => {
    const { runSessionCheck } = await load();
    const result = await runSessionCheck({
      getToken: async () => "super-secret-id-token",
      verify: async () => admin,
    });
    expect(JSON.stringify(result)).not.toContain("super-secret-id-token");
    expect(Object.keys(result).sort()).toEqual(["admin", "ok"]);
  });
});

describe("sessionErrorMessage", () => {
  it.each([
    ["not_authenticated", /inicie sesión/i],
    ["session_expired", /sesión expiró/i],
    ["admin_not_found", /permisos de administrador/i],
    ["verification_failed", /no se pudo verificar/i],
    ["unexpected", /no se pudo verificar/i],
  ])("maps %s to a safe Spanish message", async (reason, pattern) => {
    const { sessionErrorMessage } = await load();
    expect(sessionErrorMessage(reason)).toMatch(pattern);
  });
});

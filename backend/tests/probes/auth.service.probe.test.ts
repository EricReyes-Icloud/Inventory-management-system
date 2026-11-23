// Independent probes for S2 service contract (real src/services/auth.service.js).
import { describe, it, expect, vi } from "vitest";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SERVICE = path.resolve(ROOT, "src/services/auth.service.js");

function fresh() {
  delete require.cache[require.resolve(SERVICE)];
  return require(SERVICE);
}

const snap = (docs: any[]) => ({ empty: docs.length === 0, docs });
const doc = (data: any) => ({ data: () => data });

describe("probe: loginWithIdToken business rules", () => {
  it("P1 returns {token, admin{uid,email,nombre}, passwordChangeRequired} for an Admin_2 admin and calls verify then find", async () => {
    const { loginWithIdToken } = fresh();
    const calls: string[] = [];
    const verifyIdToken = vi.fn(async (t: string) => {
      calls.push("verify:" + t);
      return { uid: "U2", email: "a2@x.com" };
    });
    const findAdminByEmail = vi.fn(async (e: string) => {
      calls.push("find:" + e);
      return snap([doc({ Nombre: "Dos", passwordChangeRequired: true, Rol: "admin" })]);
    });

    const result = await loginWithIdToken("IDT", { verifyIdToken, findAdminByEmail });

    expect(result).toEqual({
      token: "IDT",
      admin: { uid: "U2", email: "a2@x.com", nombre: "Dos" },
      passwordChangeRequired: true,
    });
    expect(Object.keys(result).sort()).toEqual(["admin", "passwordChangeRequired", "token"]);
    expect(calls).toEqual(["verify:IDT", "find:a2@x.com"]);
  });

  it("P2 passwordChangeRequired is false only when the doc flag is not literal true", async () => {
    const { loginWithIdToken } = fresh();
    for (const flag of [false, undefined, "true", 1]) {
      const r = await loginWithIdToken("T", {
        verifyIdToken: async () => ({ uid: "u", email: "e@x.com" }),
        findAdminByEmail: async () => snap([doc({ Nombre: "N", passwordChangeRequired: flag })]),
      });
      expect(r.passwordChangeRequired).toBe(false);
    }
    const r2 = await loginWithIdToken("T", {
      verifyIdToken: async () => ({ uid: "u", email: "e@x.com" }),
      findAdminByEmail: async () => snap([doc({ Nombre: "N", passwordChangeRequired: true })]),
    });
    expect(r2.passwordChangeRequired).toBe(true);
  });

  it("P3 rejects missing/empty/non-string idToken as invalid_request without verifying", async () => {
    const { loginWithIdToken } = fresh();
    const verifyIdToken = vi.fn();
    for (const bad of [undefined, null, "", "   ", 123, {}, []]) {
      const err: any = await loginWithIdToken(bad as any, { verifyIdToken, findAdminByEmail: vi.fn() }).catch((e: any) => e);
      expect(err.name).toBe("AuthServiceError");
      expect(err.code).toBe("invalid_request");
      expect(err.message).toBe("idToken is required");
    }
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("P4 maps a verifyIdToken rejection to invalid_token and never queries Firestore", async () => {
    const { loginWithIdToken } = fresh();
    const findAdminByEmail = vi.fn();
    const err: any = await loginWithIdToken("bad", {
      verifyIdToken: async () => { throw new Error("auth/id-token-expired"); },
      findAdminByEmail,
    }).catch((e: any) => e);
    expect(err.code).toBe("invalid_token");
    expect(findAdminByEmail).not.toHaveBeenCalled();
  });

  it("P5 maps a decoded token without email to invalid_token", async () => {
    const { loginWithIdToken } = fresh();
    for (const decoded of [{ uid: "u" }, { uid: "u", email: "" }, { uid: "u", email: 42 }, null]) {
      const err: any = await loginWithIdToken("t", {
        verifyIdToken: async () => decoded,
        findAdminByEmail: vi.fn(),
      }).catch((e: any) => e);
      expect(err.code).toBe("invalid_token");
    }
  });

  it("P6 reports a non-admin as admin_not_found (not 401) and leaks no token", async () => {
    const { loginWithIdToken } = fresh();
    for (const empty of [snap([]), { empty: true, docs: [] }, null, undefined]) {
      const err: any = await loginWithIdToken("tok", {
        verifyIdToken: async () => ({ uid: "u", email: "stranger@x.com" }),
        findAdminByEmail: async () => empty as any,
      }).catch((e: any) => e);
      expect(err.name).toBe("AuthServiceError");
      expect(err.code).toBe("admin_not_found");
      expect(err.message).toBe("Admin not found");
    }
  });

  it("P7 propagates a Firestore read failure (does NOT become admin_not_found)", async () => {
    const { loginWithIdToken } = fresh();
    const err: any = await loginWithIdToken("tok", {
      verifyIdToken: async () => ({ uid: "u", email: "e@x.com" }),
      findAdminByEmail: async () => { throw new Error("firestore unavailable"); },
    }).catch((e: any) => e);
    expect(err.message).toBe("firestore unavailable");
    expect(err.code).toBeUndefined();
    expect(err.name).not.toBe("AuthServiceError");
  });

  it("P8 production defaults use firebase-admin.verifyIdToken and getAdminByEmailAnyCollection when no deps injected", () => {
    const src = require("fs").readFileSync(SERVICE, "utf8");
    expect(src).toContain('require("firebase-admin").auth().verifyIdToken(token)');
    expect(src).toContain("getAdminByEmailAnyCollection");
    const mod = fresh();
    expect(typeof mod.loginWithIdToken).toBe("function");
    expect(mod.AUTH_ERROR_CODES).toEqual({
      INVALID_REQUEST: "invalid_request",
      INVALID_TOKEN: "invalid_token",
      ADMIN_NOT_FOUND: "admin_not_found",
    });
  });
});

describe("probe: token normalization and response surface", () => {
  it("P9 surrounding whitespace is trimmed before verification and echoed trimmed", async () => {
    const { loginWithIdToken } = fresh();
    const verifyIdToken = vi.fn(async () => ({ uid: "u", email: "e@x.com" }));
    const r = await loginWithIdToken("  TOKENS  ", {
      verifyIdToken,
      findAdminByEmail: async () => snap([doc({ Nombre: "N", passwordChangeRequired: false })]),
    });
    expect(verifyIdToken).toHaveBeenCalledWith("TOKENS");
    expect(r.token).toBe("TOKENS");
  });

  it("P10 response carries only token/admin/passwordChangeRequired (no decoded claims leaked)", async () => {
    const { loginWithIdToken } = fresh();
    const r = await loginWithIdToken("t", {
      verifyIdToken: async () => ({ uid: "u", email: "e@x.com", role: "super", custom: "x" }),
      findAdminByEmail: async () => snap([doc({ Nombre: "N", Telefono: "+57", Rol: "admin", passwordChangeRequired: false })]),
    });
    expect(Object.keys(r).sort()).toEqual(["admin", "passwordChangeRequired", "token"]);
    expect(Object.keys(r.admin).sort()).toEqual(["email", "nombre", "uid"]);
    expect(JSON.stringify(r)).not.toContain("super");
  });
});

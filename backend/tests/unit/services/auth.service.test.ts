import { describe, it, expect, vi } from "vitest";

/**
 * T2 / S2 of odd/tasks/frontend-login-mvp0.md.
 *
 * The login service verifies a Firebase ID token issued by the client SDK,
 * checks admin membership and returns the token plus the first-login flag.
 * Every dependency is injected: no test touches live Firebase.
 */

const SERVICE_PATH = "../../../src/services/auth.service.js";

function adminSnap(data: any) {
  return { empty: false, docs: [{ data: () => data }] };
}

function deps(overrides: any = {}) {
  return {
    verifyIdToken: vi.fn(async () => ({ uid: "uid-1", email: "july@example.com" })),
    findAdminByEmail: vi.fn(async () =>
      adminSnap({ Nombre: "July Buitrago", passwordChangeRequired: true })
    ),
    ...overrides,
  };
}

describe("loginWithIdToken", () => {
  it("returns the verified token and admin data for an Admin_2 member", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps();

    const result = await service.loginWithIdToken("id-token-123", injected);

    expect(result).toEqual({
      token: "id-token-123",
      admin: {
        uid: "uid-1",
        email: "july@example.com",
        nombre: "July Buitrago",
      },
      passwordChangeRequired: true,
    });
    expect(injected.findAdminByEmail).toHaveBeenCalledWith("july@example.com");
  });

  it("reports passwordChangeRequired false when the flag is absent", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps({
      findAdminByEmail: vi.fn(async () => adminSnap({ Nombre: "Eric Reyes" })),
    });

    const result = await service.loginWithIdToken("id-token-123", injected);

    expect(result.passwordChangeRequired).toBe(false);
  });

  it("rejects a missing idToken before verifying anything", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps();

    await expect(service.loginWithIdToken(undefined, injected)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(injected.verifyIdToken).not.toHaveBeenCalled();
    expect(injected.findAdminByEmail).not.toHaveBeenCalled();
  });

  it("rejects a non-string idToken", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps();

    await expect(service.loginWithIdToken({ token: "x" }, injected)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(injected.verifyIdToken).not.toHaveBeenCalled();
  });

  it("maps a verification failure to invalid_token", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps({
      verifyIdToken: vi.fn(async () => {
        throw Object.assign(new Error("auth/id-token-expired"), { code: "auth/id-token-expired" });
      }),
    });

    await expect(service.loginWithIdToken("expired", injected)).rejects.toMatchObject({
      code: "invalid_token",
    });
    expect(injected.findAdminByEmail).not.toHaveBeenCalled();
  });

  it("rejects a verified token with no email", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps({ verifyIdToken: vi.fn(async () => ({ uid: "uid-1" })) });

    await expect(service.loginWithIdToken("no-email", injected)).rejects.toMatchObject({
      code: "invalid_token",
    });
    expect(injected.findAdminByEmail).not.toHaveBeenCalled();
  });

  it("rejects a valid Firebase user that is not an admin", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps({
      findAdminByEmail: vi.fn(async () => ({ empty: true, docs: [] })),
    });

    await expect(service.loginWithIdToken("id-token-123", injected)).rejects.toMatchObject({
      code: "admin_not_found",
    });
  });

  it("propagates unexpected repository errors instead of hiding them", async () => {
    const service = require(SERVICE_PATH);
    const injected = deps({
      findAdminByEmail: vi.fn(async () => {
        throw new Error("firestore unavailable");
      }),
    });

    await expect(service.loginWithIdToken("id-token-123", injected)).rejects.toThrow(
      "firestore unavailable"
    );
  });
});

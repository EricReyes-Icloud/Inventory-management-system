import { describe, it, expect, beforeAll, vi } from "vitest";
import { createMockDb, buildMockStore } from "../../helpers/firestoreMock";

/**
 * T1 / S1 of odd/tasks/frontend-login-mvp0.md.
 *
 * The seed must read the three REAL Firestore paths, create matching Firebase
 * Auth users with secure random passwords, and flag the Firestore documents
 * with passwordChangeRequired so the login flow can force a first change.
 * No test in this file touches live Firebase.
 */

const scriptPath = "../../../../backend/scripts/seed-admins.js";
const ADMIN_ROOT = "Usuarios/Usuarios";
const SUBCOLLECTIONS = ["Admin", "Admin_2", "Admin_3"];

const ADMINS = [
  {
    id: "Admin",
    Email: "eric@example.com",
    Nombre: "Eric Reyes",
    Rol: "admin",
    Activo: true,
    Telefono: "+573001112233",
  },
  {
    id: "Admin_2",
    Email: "july@example.com",
    Nombre: "July Buitrago",
    Rol: "admin",
    Activo: true,
    Telefono: "+573004445566",
  },
  {
    id: "Admin_3",
    Email: "edwin@example.com",
    Nombre: "Edwin Reyes",
    Rol: "admin",
    Activo: true,
    Telefono: "+573007778899",
  },
];

function adminStore(admins = ADMINS): Record<string, any> {
  const store: Record<string, any> = {};
  for (const admin of admins) {
    store[`${ADMIN_ROOT}/${admin.id}/${admin.id}`] = { ...admin };
  }
  return store;
}

function scenario(store: Record<string, any>) {
  const { mockDb, refs } = createMockDb();
  buildMockStore({ products: store }, mockDb, refs);
  return { mockDb, refs };
}

function authMock(existingEmails: string[] = []) {
  return {
    getUserByEmail: vi.fn(async (email: string) => {
      if (existingEmails.includes(email)) {
        return { uid: `existing-${email}`, email };
      }
      const error: any = new Error("auth/user-not-found");
      error.code = "auth/user-not-found";
      throw error;
    }),
    createUser: vi.fn(async ({ email }: { email: string }) => ({
      uid: `new-${email}`,
      email,
    })),
  };
}

describe("collectAdmins", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("reads the three real Usuarios/Usuarios subcollections in order", async () => {
    const { mockDb } = scenario(adminStore());
    const entries = await script.collectAdmins(mockDb);

    expect(entries.map((e: any) => e.path)).toEqual([
      `${ADMIN_ROOT}/Admin/Admin`,
      `${ADMIN_ROOT}/Admin_2/Admin_2`,
      `${ADMIN_ROOT}/Admin_3/Admin_3`,
    ]);
    expect(entries.map((e: any) => e.email)).toEqual(ADMINS.map((a) => a.Email));
    expect(entries.map((e: any) => e.nombre)).toEqual(ADMINS.map((a) => a.Nombre));
  });

  it("never reads the bogus Users/Users/Admin path", async () => {
    const { mockDb } = scenario(adminStore());
    await script.collectAdmins(mockDb);

    for (const call of (mockDb.collection as any).mock.calls) {
      expect(call[0]).not.toBe("Users");
    }
  });

  it("fails fast when a subcollection is empty", async () => {
    const { mockDb } = scenario(adminStore(ADMINS.slice(0, 2)));
    await expect(script.collectAdmins(mockDb)).rejects.toThrow(/Admin_3/);
  });

  it("fails fast when a subcollection has more than one document", async () => {
    const store = adminStore();
    store[`${ADMIN_ROOT}/Admin/extra`] = { ...ADMINS[0], Email: "extra@example.com" };
    const { mockDb } = scenario(store);
    await expect(script.collectAdmins(mockDb)).rejects.toThrow(/more than one/);
  });

  it("fails fast on an inactive admin or a missing Email", async () => {
    const inactive = ADMINS.map((a, i) => (i === 1 ? { ...a, Activo: false } : a));
    const { mockDb: inactiveDb } = scenario(adminStore(inactive));
    await expect(script.collectAdmins(inactiveDb)).rejects.toThrow(/Activo/);

    const noEmail = ADMINS.map((a, i) => (i === 2 ? { ...a, Email: "" } : a));
    const { mockDb: noEmailDb } = scenario(adminStore(noEmail));
    await expect(script.collectAdmins(noEmailDb)).rejects.toThrow(/Email/);
  });
});

describe("seedAdmins write path", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("creates one Auth user per admin with a unique secure random password", async () => {
    const { mockDb } = scenario(adminStore());
    const auth = authMock();
    const result = await script.seedAdmins(mockDb, auth);

    expect(auth.createUser).toHaveBeenCalledTimes(3);
    const calls: any[] = (auth.createUser as any).mock.calls;
    const passwords = calls.map((c) => c[0].password);

    expect(new Set(passwords).size).toBe(3);
    for (const password of passwords) {
      expect(typeof password).toBe("string");
      expect(password.length).toBeGreaterThanOrEqual(24);
    }
    expect(calls.map((c) => c[0].email)).toEqual(ADMINS.map((a) => a.Email));
    expect(calls.map((c) => c[0].displayName)).toEqual(ADMINS.map((a) => a.Nombre));
    expect(result.created).toHaveLength(3);
  });

  it("flags exactly the three existing Firestore docs with a single merged batch", async () => {
    const { mockDb, refs } = scenario(adminStore());
    await script.seedAdmins(mockDb, authMock());

    expect(refs.batchCommit).toHaveBeenCalledTimes(1);
    const calls: any[] = refs.batchSet.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c[0].path)).toEqual([
      `${ADMIN_ROOT}/Admin/Admin`,
      `${ADMIN_ROOT}/Admin_2/Admin_2`,
      `${ADMIN_ROOT}/Admin_3/Admin_3`,
    ]);
    for (const call of calls) {
      expect(call[1]).toEqual({ passwordChangeRequired: true });
      expect(call[2]).toEqual({ merge: true });
    }
  });

  it("skips Auth users that already exist and leaves their flagged Firestore docs untouched", async () => {
    const store = adminStore();
    store[`${ADMIN_ROOT}/Admin_2/Admin_2`] = {
      ...ADMINS[1],
      passwordChangeRequired: true,
    };
    const { mockDb, refs } = scenario(store);
    const auth = authMock([ADMINS[1].Email]);
    const result = await script.seedAdmins(mockDb, auth);

    expect(auth.createUser).toHaveBeenCalledTimes(2);
    expect(result.skipped).toEqual([ADMINS[1].Email]);
    expect(refs.batchSet).toHaveBeenCalledTimes(2);
    expect(refs.batchSet.mock.calls.map((c: any[]) => c[0].path)).not.toContain(
      `${ADMIN_ROOT}/Admin_2/Admin_2`
    );
  });

  it("flags an existing Auth user whose Firestore document is still missing the flag", async () => {
    const { mockDb, refs } = scenario(adminStore());
    const auth = authMock(ADMINS.map((a) => a.Email));
    const result = await script.seedAdmins(mockDb, auth);

    expect(auth.createUser).not.toHaveBeenCalled();
    expect(refs.batchSet).toHaveBeenCalledTimes(3);
    expect(result.flagsWritten).toBe(3);
  });

  it("does not open a batch when every Auth user exists and is already flagged", async () => {
    const store = adminStore();
    for (const admin of ADMINS) {
      store[`${ADMIN_ROOT}/${admin.id}/${admin.id}`] = {
        ...admin,
        passwordChangeRequired: true,
      };
    }
    const { mockDb, refs } = scenario(store);
    const result = await script.seedAdmins(mockDb, authMock(ADMINS.map((a) => a.Email)));

    expect(mockDb.batch).not.toHaveBeenCalled();
    expect(refs.batchCommit).not.toHaveBeenCalled();
    expect(result.flagsWritten).toBe(0);
  });

  it("propagates unexpected Auth errors instead of silently skipping them", async () => {
    const { mockDb } = scenario(adminStore());
    const auth = authMock();
    auth.getUserByEmail.mockRejectedValueOnce(
      Object.assign(new Error("auth/network-error"), { code: "auth/network-error" })
    );

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(/network-error/);
    expect(auth.createUser).not.toHaveBeenCalled();
  });
});

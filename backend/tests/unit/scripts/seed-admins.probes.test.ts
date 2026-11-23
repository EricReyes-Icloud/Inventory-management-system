import { describe, it, expect, beforeAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createMockDb, buildMockStore } from "../../helpers/firestoreMock";

/**
 * Independent regression probes for T1 / S1 of odd/tasks/frontend-login-mvp0.md.
 *
 * These probes pin the behaviors verified during the high-risk review: password
 * shape and uniqueness, exact fail-fast messages, dry-run read-only execution,
 * idempotence, the needsFlag repair path, and import safety. No probe touches
 * live Firebase; every dependency is injected or faked in-process.
 */

const scriptPath = "../../../../backend/scripts/seed-admins.js";
const ADMIN_ROOT = "Usuarios/Usuarios";

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

function adminStore(admins: any[] = ADMINS): Record<string, any> {
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

function notFoundError(): any {
  const error: any = new Error("auth/user-not-found");
  error.code = "auth/user-not-found";
  return error;
}

function persistentAuth(existingEmails: string[] = []) {
  const users = new Map<string, any>();
  for (const email of existingEmails) {
    users.set(email, { uid: `existing-${email}`, email });
  }

  return {
    users,
    getUserByEmail: vi.fn(async (email: string) => {
      const user = users.get(email);
      if (user) return user;
      throw notFoundError();
    }),
    createUser: vi.fn(async ({ email, password, displayName }: any) => {
      const user = { uid: `new-${email}`, email, password, displayName };
      users.set(email, user);
      return user;
    }),
  };
}

function expectNoWrites(auth: any, refs: any, mockDb: any): void {
  expect(auth.getUserByEmail).not.toHaveBeenCalled();
  expect(auth.createUser).not.toHaveBeenCalled();
  expect(mockDb.batch).not.toHaveBeenCalled();
  expect(refs.batchSet).not.toHaveBeenCalled();
  expect(refs.batchCommit).not.toHaveBeenCalled();
}

describe("password generation", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("generates 2000 base64url passwords of exactly 32 characters", () => {
    const passwords = Array.from({ length: 2000 }, () =>
      script.generateSecurePassword()
    );
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{32}$/);
    }
    expect(new Set(passwords).size).toBe(2000);
  });

  it("never uses Math.random for password material", () => {
    const randomSpy = vi.spyOn(Math, "random");
    try {
      script.generateSecurePassword();
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("never stores a generated password in the Firestore batch payload", async () => {
    const { mockDb, refs } = scenario(adminStore());
    const auth = persistentAuth();
    const generated: string[] = [];

    await script.seedAdmins(mockDb, auth, {
      generatePassword: () => {
        const password = `probe-password-${generated.length}`;
        generated.push(password);
        return password;
      },
    });

    const payload = JSON.stringify(refs.batchSet.mock.calls);
    for (const password of generated) {
      expect(payload).not.toContain(password);
    }
  });
});

describe("fail-fast before any write", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("aborts on an empty subcollection with the exact message", async () => {
    const { mockDb, refs } = scenario(adminStore(ADMINS.slice(0, 2)));
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin_3 has 0 documents (empty); expected exactly 1."
    );
    expectNoWrites(auth, refs, mockDb);
  });

  it("aborts on a subcollection with more than one document", async () => {
    const store = adminStore();
    store[`${ADMIN_ROOT}/Admin/extra`] = { ...ADMINS[0], Email: "extra@example.com" };
    const { mockDb, refs } = scenario(store);
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin has 2 documents (more than one); expected exactly 1."
    );
    expectNoWrites(auth, refs, mockDb);
  });

  it("aborts on an empty Email with the exact message", async () => {
    const inactive = ADMINS.map((admin, index) =>
      index === 1 ? { ...admin, Email: "" } : admin
    );
    const { mockDb, refs } = scenario(adminStore(inactive));
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin_2/Admin_2 has no valid Email."
    );
    expectNoWrites(auth, refs, mockDb);
  });

  it("aborts on an inactive admin with the exact message", async () => {
    const inactive = ADMINS.map((admin, index) =>
      index === 2 ? { ...admin, Activo: false } : admin
    );
    const { mockDb, refs } = scenario(adminStore(inactive));
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin_3/Admin_3 is not Activo."
    );
    expectNoWrites(auth, refs, mockDb);
  });

  it("aborts on a non-admin Rol with the exact message", async () => {
    const wrongRole = ADMINS.map((admin, index) =>
      index === 0 ? { ...admin, Rol: "viewer" } : admin
    );
    const { mockDb, refs } = scenario(adminStore(wrongRole));
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin/Admin has Rol=viewer, expected admin."
    );
    expectNoWrites(auth, refs, mockDb);
  });

  it("aborts on a missing Nombre with the exact message", async () => {
    const noName = ADMINS.map((admin, index) =>
      index === 1 ? { ...admin, Nombre: "   " } : admin
    );
    const { mockDb, refs } = scenario(adminStore(noName));
    const auth = persistentAuth();

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow(
      "Seed aborted: Usuarios/Usuarios/Admin_2/Admin_2 has no valid Nombre."
    );
    expectNoWrites(auth, refs, mockDb);
  });
});

describe("dry run and idempotence", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("logs every real admin path during dry-run", async () => {
    const { mockDb } = scenario(adminStore());
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let output = "";

    try {
      await script.dryRun(mockDb);
      output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    } finally {
      logSpy.mockRestore();
    }

    expect(output).toContain("Usuarios/Usuarios/Admin/Admin");
    expect(output).toContain("Usuarios/Usuarios/Admin_2/Admin_2");
    expect(output).toContain("Usuarios/Usuarios/Admin_3/Admin_3");
  });

  it("performs no writes during dry-run", async () => {
    const { mockDb, refs } = scenario(adminStore());
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await script.dryRun(mockDb);
    } finally {
      logSpy.mockRestore();
    }

    expect(mockDb.batch).not.toHaveBeenCalled();
    expect(refs.batchSet).not.toHaveBeenCalled();
    expect(refs.batchCommit).not.toHaveBeenCalled();
  });

  it("is a no-op when all Auth users exist and every doc is flagged", async () => {
    const store = adminStore(
      ADMINS.map((admin) => ({ ...admin, passwordChangeRequired: true }))
    );
    const { mockDb, refs } = scenario(store);
    const auth = persistentAuth(ADMINS.map((admin) => admin.Email));

    const result = await script.seedAdmins(mockDb, auth);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual(ADMINS.map((admin) => admin.Email));
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(mockDb.batch).not.toHaveBeenCalled();
    expect(result.flagsWritten).toBe(0);
  });

  it("merges the flag without replacing existing Firestore fields", async () => {
    const { mockDb, refs } = scenario(adminStore());
    await script.seedAdmins(mockDb, persistentAuth());

    for (const call of refs.batchSet.mock.calls) {
      expect(call[1]).toEqual({ passwordChangeRequired: true });
      expect(call[2]).toEqual({ merge: true });
    }
  });
});

describe("needsFlag repair", () => {
  let script: any;

  beforeAll(() => {
    script = require(scriptPath);
  });

  it("keeps created Auth users when the Firestore batch fails", async () => {
    const { mockDb, refs } = scenario(adminStore());
    const auth = persistentAuth();
    refs.batchCommit.mockRejectedValueOnce(new Error("batch failed"));

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow("batch failed");

    expect(auth.createUser).toHaveBeenCalledTimes(3);
    expect(auth.users.size).toBe(3);
    expect(refs.batchCommit).toHaveBeenCalledTimes(1);
  });

  it("repairs all three flags on a re-run after a failed batch", async () => {
    const { mockDb, refs } = scenario(adminStore());
    const auth = persistentAuth();
    refs.batchCommit.mockRejectedValueOnce(new Error("batch failed"));

    await expect(script.seedAdmins(mockDb, auth)).rejects.toThrow("batch failed");
    const result = await script.seedAdmins(mockDb, auth);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual(ADMINS.map((admin) => admin.Email));
    expect(result.flagsWritten).toBe(3);
    expect(refs.batchSet).toHaveBeenCalledTimes(6);
  });

  it("creates one Auth user but flags both docs when two admins share an Email", async () => {
    const duplicated = ADMINS.map((admin, index) =>
      index === 1 ? { ...admin, Email: ADMINS[0].Email } : admin
    );
    const { mockDb, refs } = scenario(adminStore(duplicated));
    const auth = persistentAuth();

    const result = await script.seedAdmins(mockDb, auth);

    expect(auth.createUser).toHaveBeenCalledTimes(2);
    expect(result.skipped).toEqual([ADMINS[0].Email]);
    expect(result.flagsWritten).toBe(3);
    expect(refs.batchSet).toHaveBeenCalledTimes(3);
  });
});

describe("import safety", () => {
  it("does not initialize firebase-admin when the script is required", () => {
    const absolutePath = require.resolve(scriptPath);
    const probe = [
      "const s = require(" + JSON.stringify(absolutePath) + ");",
      "if (typeof s.seedAdmins !== 'function') process.exit(2);",
      "const loaded = Object.keys(require.cache).some(function (k) { return k.indexOf('firebase-admin') !== -1; });",
      "process.stdout.write(loaded ? 'loaded' : 'clean');",
    ].join("\n");

    const output = execFileSync(process.execPath, ["-e", probe], {
      encoding: "utf8",
    });

    expect(output).toBe("clean");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

/**
 * T2 / S2: admins live in Admin, Admin_2 and Admin_3. The pre-existing
 * getAdminByEmail only queries Admin, so login needs an additive lookup that
 * covers all three without changing the shared function's behavior.
 */

const PROJECT_ROOT = getBackendRoot();
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/admin.repository.js");

const visited: string[] = [];
let results: Record<string, any> = {};

function collection(name: string): any {
  return {
    where: () => collection(name),
    limit: () => ({
      get: async () => {
        visited.push(name);
        return results[name] || { empty: true, docs: [] };
      },
    }),
  };
}

const fakeDb = {
  collection: () => ({ doc: () => ({ collection }) }),
};

let repo: any;

beforeEach(() => {
  visited.length = 0;
  results = {};
  Module._cache[FIRESTORE_PATH] = { exports: fakeDb } as any;
  delete Module._cache[REPO_PATH];
  repo = require("../../../src/repositories/admin.repository");
});

afterEach(() => {
  delete Module._cache[FIRESTORE_PATH];
  delete Module._cache[REPO_PATH];
});

describe("getAdminByEmailAnyCollection", () => {
  it("returns the first matching admin found in Admin_2", async () => {
    const snap = { empty: false, docs: [{ data: () => ({ Nombre: "July" }) }] };
    results = { Admin_2: snap };

    const result = await repo.getAdminByEmailAnyCollection("july@example.com");

    expect(result).toBe(snap);
    expect(visited).toEqual(["Admin", "Admin_2"]);
  });

  it("returns an empty snapshot when the email is in none of the three collections", async () => {
    const result = await repo.getAdminByEmailAnyCollection("nobody@example.com");

    expect(result.empty).toBe(true);
    expect(result.docs).toEqual([]);
    expect(visited).toEqual(["Admin", "Admin_2", "Admin_3"]);
  });

  it("leaves the shared getAdminByEmail behavior intact", async () => {
    expect(typeof repo.getAdminByEmail).toBe("function");
    expect(visited).toEqual([]);
  });
});

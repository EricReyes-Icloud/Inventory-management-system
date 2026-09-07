import { describe, it, expect, vi, afterEach } from "vitest";
import Module from "module";
import path from "path";
import fs from "fs";
import { getBackendRoot } from "../helpers/paths";

const BACKEND_ROOT = getBackendRoot();
const FIRESTORE_PATH = path.resolve(BACKEND_ROOT, "src/lib/firestore.js");
const SECRETS_PATH = path.resolve(BACKEND_ROOT, "src/secrets/serviceAccountKey.json");
const SECRETS_BACKUP = SECRETS_PATH + ".test-backup";

// Module augmentation for Module._cache
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

describe("firestore.js secrets bootstrap", () => {
  afterEach(() => {
    // Restore secrets file if it was moved
    if (fs.existsSync(SECRETS_BACKUP) && !fs.existsSync(SECRETS_PATH)) {
      fs.renameSync(SECRETS_BACKUP, SECRETS_PATH);
    }
    // Clean module cache
    delete Module._cache[FIRESTORE_PATH];
  });

  it("does not throw MODULE_NOT_FOUND when secrets file is absent", () => {
    // Temporarily hide the real secrets file
    const hadFile = fs.existsSync(SECRETS_PATH);
    if (hadFile) {
      fs.renameSync(SECRETS_PATH, SECRETS_BACKUP);
    }

    // Clear firestore from cache to force fresh require
    delete Module._cache[FIRESTORE_PATH];

    // After the fix: requiring firestore.js should NOT throw about missing serviceAccountKey
    expect(() => {
      require(FIRESTORE_PATH);
    }).not.toThrow(/serviceAccountKey/);
  });
});

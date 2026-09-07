import { describe, it, expect } from "vitest";
import path from "path";
import { getBackendRoot } from "../helpers/paths";

describe("getBackendRoot", () => {
  it("returns an absolute path ending with backend", () => {
    const root = getBackendRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(root.endsWith("backend")).toBe(true);
  });

  it("resolves to the same directory regardless of process.cwd()", () => {
    const original = process.cwd();
    const fromRoot = getBackendRoot();
    // Temporarily change cwd to repo root
    process.chdir(path.resolve(original, "../.."));
    const fromRepoRoot = getBackendRoot();
    process.chdir(original);
    expect(fromRoot).toBe(fromRepoRoot);
  });
});

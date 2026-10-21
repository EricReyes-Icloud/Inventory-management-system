// backend/tests/unit/config.test.ts
// Unit suite for src/config.js — the single place where PORT is read.
//
// RED against the pre-change baseline: backend/src/config.js does not exist,
// and backend/src/index.js:53 read process.env.PORT inline with no validation
// (a non-numeric PORT made net.Server.listen() bind a named pipe instead of
// failing loudly).

import { describe, it, expect } from "vitest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const PROJECT_ROOT = getBackendRoot();
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "src/config.js");

function loadConfig() {
  delete Module._cache[CONFIG_PATH];
  return require("../../src/config");
}

// ═══════════════════════════════════════════════════════════
// resolvePort — pure function
// ═══════════════════════════════════════════════════════════

describe("config.resolvePort", () => {
  it("falls back to 4000 when PORT is not set", () => {
    const { resolvePort } = loadConfig();
    expect(resolvePort(undefined)).toBe(4000);
  });

  it("falls back to 4000 when PORT is empty or blank", () => {
    const { resolvePort } = loadConfig();
    expect(resolvePort("")).toBe(4000);
    expect(resolvePort("   ")).toBe(4000);
  });

  it("returns the configured port when PORT is a valid integer", () => {
    const { resolvePort } = loadConfig();
    expect(resolvePort("8080")).toBe(8080);
    expect(resolvePort(" 8080 ")).toBe(8080);
  });

  it("accepts port 0 (random port assignment)", () => {
    const { resolvePort } = loadConfig();
    expect(resolvePort("0")).toBe(0);
  });

  it("accepts the highest valid port", () => {
    const { resolvePort } = loadConfig();
    expect(resolvePort("65535")).toBe(65535);
  });

  it("throws when PORT is not a plain integer", () => {
    const { resolvePort } = loadConfig();
    // "4a00" today reaches net.Server.listen("4a00") → binds a NAMED PIPE.
    expect(() => resolvePort("4a00")).toThrow(/Invalid PORT/);
    expect(() => resolvePort("abc")).toThrow(/Invalid PORT/);
    expect(() => resolvePort("80.5")).toThrow(/Invalid PORT/);
    expect(() => resolvePort("0x1F")).toThrow(/Invalid PORT/);
    expect(() => resolvePort("-1")).toThrow(/Invalid PORT/);
  });

  it("throws when PORT is out of range", () => {
    const { resolvePort } = loadConfig();
    expect(() => resolvePort("65536")).toThrow(/Invalid PORT/);
    expect(() => resolvePort("99999")).toThrow(/Invalid PORT/);
  });

  it("names the offending value in the error message", () => {
    const { resolvePort } = loadConfig();
    expect(() => resolvePort("4a00")).toThrow(/4a00/);
  });
});

// ═══════════════════════════════════════════════════════════
// port — resolved once per process
// ═══════════════════════════════════════════════════════════

describe("config.port", () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it("is 4000 when PORT is not set in the environment", () => {
    delete process.env.PORT;
    const { port } = loadConfig();
    expect(port).toBe(4000);
  });

  it("is the value of PORT when it is set in the environment", () => {
    process.env.PORT = "9090";
    const { port } = loadConfig();
    expect(port).toBe(9090);
  });

  it("fails fast when PORT in the environment is invalid", () => {
    process.env.PORT = "4a00";
    expect(() => loadConfig()).toThrow(/Invalid PORT/);
  });
});

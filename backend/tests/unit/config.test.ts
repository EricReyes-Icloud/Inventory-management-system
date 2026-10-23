// backend/tests/unit/config.test.ts
// Unit suite for src/config.js — the single place where PORT is read.
//
// RED against the pre-change baseline: backend/src/config.js does not exist,
// and backend/src/index.js:53 read process.env.PORT inline with no validation
// (a non-numeric PORT made net.Server.listen() bind a named pipe instead of
// failing loudly).

import { describe, it, expect, afterEach } from "vitest";
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

// ═══════════════════════════════════════════════════════════
// resolvePositiveInt — pure function
// ═══════════════════════════════════════════════════════════

describe("config.resolvePositiveInt", () => {
  it("falls back to the default when the value is not set", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(resolvePositiveInt(undefined, 60, "SOME_VAR")).toBe(60);
    expect(resolvePositiveInt(null, 60, "SOME_VAR")).toBe(60);
  });

  it("falls back to the default when the value is empty or blank", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(resolvePositiveInt("", 60, "SOME_VAR")).toBe(60);
    expect(resolvePositiveInt("   ", 60, "SOME_VAR")).toBe(60);
  });

  it("returns the configured value when it is a positive integer", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(resolvePositiveInt("30", 60, "SOME_VAR")).toBe(30);
    expect(resolvePositiveInt("  30  ", 60, "SOME_VAR")).toBe(30);
  });

  it("throws when the value is not a plain integer", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(() => resolvePositiveInt("abc", 60, "SOME_VAR")).toThrow(/Invalid SOME_VAR/);
    expect(() => resolvePositiveInt("12.5", 60, "SOME_VAR")).toThrow(/Invalid SOME_VAR/);
    expect(() => resolvePositiveInt("1e3", 60, "SOME_VAR")).toThrow(/Invalid SOME_VAR/);
  });

  it("throws when the value is zero or negative", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(() => resolvePositiveInt("0", 60, "SOME_VAR")).toThrow(/Invalid SOME_VAR/);
    expect(() => resolvePositiveInt("-5", 60, "SOME_VAR")).toThrow(/Invalid SOME_VAR/);
  });

  it("names the offending value and the variable in the error message", () => {
    const { resolvePositiveInt } = loadConfig();
    expect(() => resolvePositiveInt("abc", 60, "SOME_VAR")).toThrow(/SOME_VAR/);
    expect(() => resolvePositiveInt("abc", 60, "SOME_VAR")).toThrow(/abc/);
  });
});

// ═══════════════════════════════════════════════════════════
// parseAdminAllowedNumbers — WhatsApp admin allowlist
// ═══════════════════════════════════════════════════════════

describe("config.parseAdminAllowedNumbers", () => {
  it("returns an empty list when the value is not set", () => {
    const { parseAdminAllowedNumbers } = loadConfig();
    expect(parseAdminAllowedNumbers(undefined)).toEqual([]);
  });

  it("returns an empty list when the value is empty or blank", () => {
    const { parseAdminAllowedNumbers } = loadConfig();
    expect(parseAdminAllowedNumbers("")).toEqual([]);
    expect(parseAdminAllowedNumbers("   ")).toEqual([]);
  });

  it("trims the entries of a comma-separated list", () => {
    const { parseAdminAllowedNumbers } = loadConfig();
    expect(parseAdminAllowedNumbers(" +573138861417 , +573213413474 ")).toEqual([
      "+573138861417",
      "+573213413474",
    ]);
  });

  it("drops empty entries between commas", () => {
    const { parseAdminAllowedNumbers } = loadConfig();
    expect(parseAdminAllowedNumbers("+573138861417,,  ,+573213413474,")).toEqual([
      "+573138861417",
      "+573213413474",
    ]);
  });

  it("returns a single entry as a one-element list", () => {
    const { parseAdminAllowedNumbers } = loadConfig();
    expect(parseAdminAllowedNumbers("+573138861417")).toEqual(["+573138861417"]);
  });
});

// ═══════════════════════════════════════════════════════════
// rateLimit — window and max for the order-creation paths
// ═══════════════════════════════════════════════════════════

describe("config.rateLimit", () => {
  const originalWindow = process.env.RATE_LIMIT_WINDOW_MS;
  const originalMax = process.env.RATE_LIMIT_MAX;

  afterEach(() => {
    if (originalWindow === undefined) {
      delete process.env.RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.RATE_LIMIT_WINDOW_MS = originalWindow;
    }
    if (originalMax === undefined) {
      delete process.env.RATE_LIMIT_MAX;
    } else {
      process.env.RATE_LIMIT_MAX = originalMax;
    }
  });

  it("uses the 15 minute / 60 request defaults when nothing is configured", () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX;

    const { rateLimit } = loadConfig();

    expect(rateLimit.windowMs).toBe(900000);
    expect(rateLimit.max).toBe(60);
  });

  it("uses the configured window and max when the environment provides them", () => {
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.RATE_LIMIT_MAX = "5";

    const { rateLimit } = loadConfig();

    expect(rateLimit.windowMs).toBe(60000);
    expect(rateLimit.max).toBe(5);
  });

  it("fails fast when RATE_LIMIT_MAX is invalid", () => {
    process.env.RATE_LIMIT_MAX = "0";

    expect(() => loadConfig()).toThrow(/Invalid RATE_LIMIT_MAX/);
  });

  it("fails fast when RATE_LIMIT_WINDOW_MS is invalid", () => {
    process.env.RATE_LIMIT_WINDOW_MS = "abc";

    expect(() => loadConfig()).toThrow(/Invalid RATE_LIMIT_WINDOW_MS/);
  });
});

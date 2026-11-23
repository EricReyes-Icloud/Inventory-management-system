// Verifier probes: service worker must never intercept /api/ or cross-origin requests.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url)); // frontend/src
const swSource = readFileSync(path.join(here, "../public/sw.js"), "utf8");

function loadSw() {
  const handlers = {};
  const putCalls = [];
  const cacheStores = [];
  const cache = {
    addAll: async (urls) => { cacheStores.push(urls); },
    put: async (...args) => { putCalls.push(args); },
    match: async () => undefined,
  };
  const cachesApi = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  };
  const self = {
    location: { origin: "http://app.test" },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const context = vm.createContext({ self, caches: cachesApi, URL, Promise, console, fetch: async () => ({ ok: true }) });
  vm.runInContext(swSource, context);
  return { handlers, cacheStores, putCalls, self };
}

function fireFetch(handlers, { method = "GET", url }) {
  let respondWithCalls = 0;
  let waitUntilCalls = 0;
  handlers.fetch({ request: { method, url }, respondWith: () => { respondWithCalls += 1; }, waitUntil: () => { waitUntilCalls += 1; } });
  return respondWithCalls;
}

describe("sw.js fetch guard", () => {
  const P = [
    ["same-origin /api/auth/login", "GET", "http://app.test/api/auth/login", 0],
    ["same-origin /api/auth/login with query", "GET", "http://app.test/api/auth/login?x=1", 0],
    ["same-origin /api/", "GET", "http://app.test/api/", 0],
    ["cross-origin api host", "GET", "https://api.test/api/auth/login", 0],
    ["cross-origin arbitrary", "GET", "https://evil.test/track.js", 0],
    ["POST to /api/auth/login", "POST", "http://app.test/api/auth/login", 0],
    ["same-origin shell nav", "GET", "http://app.test/login", 1],
    ["same-origin asset", "GET", "http://app.test/assets/index.js", 1],
    ["same-origin root", "GET", "http://app.test/", 1],
    ["boundary: /api without trailing slash", "GET", "http://app.test/api", 1],
  ];
  for (const [name, method, url, expected] of P) {
    it(`${name} -> respondWith ${expected ? "called" : "not called"}`, () => {
      const { handlers } = loadSw();
      expect(fireFetch(handlers, { method, url })).toBe(expected);
    });
  }

  it("install handler only precaches same-origin shell assets, zero /api entries", () => {
    const { handlers, cacheStores } = loadSw();
    let waited = null;
    handlers.install({ waitUntil: (p) => { waited = p; } });
    expect(waited).toBeDefined();
    return waited.then(() => {
      expect(cacheStores).toHaveLength(1);
      const urls = cacheStores[0];
      expect(urls.some((u) => u.includes("/api"))).toBe(false);
      expect(urls.every((u) => u.startsWith("/"))).toBe(true);
    });
  });

  it("never writes a response into the cache", () => {
    const { handlers, putCalls } = loadSw();
    fireFetch(handlers, { method: "GET", url: "http://app.test/assets/a.js" });
    fireFetch(handlers, { method: "GET", url: "http://app.test/api/auth/login" });
    expect(putCalls).toHaveLength(0);
  });
});

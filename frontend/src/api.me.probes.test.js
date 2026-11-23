// Transport probes for the read-only session check used by the route guard.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubFetch({ status = 200, body = {}, jsonFails = false } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (jsonFails) throw new SyntaxError("bad json");
      return body;
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function load() {
  return import("./api.js");
}

async function callVerify(token = "id-token-123") {
  const { verifyAdminSession } = await load();
  return verifyAdminSession(token);
}

describe("verifyAdminSession", () => {
  it("performs GET /api/auth/me with the ID token as a Bearer header", async () => {
    const admin = { uid: "u-1", email: "admin@colibri.test", nombre: "Admin" };
    const fetchMock = stubFetch({ body: { ok: true, admin } });

    const result = await callVerify("id-token-123");

    expect(result).toEqual(admin);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/auth/me");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer id-token-123");
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("id-token-123");
  });

  it("uses VITE_API_BASE_URL when configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.colibri.test/");
    const fetchMock = stubFetch({ body: { ok: true, admin: { uid: "u" } } });

    await callVerify("t");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.colibri.test/api/auth/me");
  });

  it("maps a backend 401 to http_401 when no coded error is present", async () => {
    stubFetch({ status: 401, body: { ok: false, message: "No autorizado" } });
    let error;
    try {
      await callVerify();
    } catch (e) {
      error = e;
    }
    expect([error?.code, error?.status]).toEqual(["http_401", 401]);
  });

  it("maps a backend 403 to http_403", async () => {
    stubFetch({ status: 403, body: { ok: false, message: "No autorizado" } });
    let error;
    try {
      await callVerify();
    } catch (e) {
      error = e;
    }
    expect([error?.code, error?.status]).toEqual(["http_403", 403]);
  });

  it("rejects an HTTP 200 with a non-JSON body", async () => {
    stubFetch({ status: 200, jsonFails: true });
    let error;
    try {
      await callVerify();
    } catch (e) {
      error = e;
    }
    expect(error?.code).toBe("http_200");
  });

  it("rejects a JSON 200 that does not confirm ok:true", async () => {
    stubFetch({ status: 200, body: { token: "leaked-id-token" } });
    let error;
    try {
      await callVerify();
    } catch (e) {
      error = e;
    }
    expect(error?.code).toBe("http_200");
  });

  it("propagates a network failure as a coded error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    let error;
    try {
      await callVerify();
    } catch (e) {
      error = e;
    }
    expect(error?.code).toBe("network_error");
    expect(error?.message).not.toContain("Failed to fetch");
  });
});

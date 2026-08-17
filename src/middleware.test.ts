import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function state(enabled: boolean) {
  return { success: true, data: { enabled, title: "Pemeliharaan", message: "Layanan sedang dipelihara.", estimatedRestoration: null, allowedPaths: [] } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

async function run(path: string, enabled: boolean) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(state(enabled))));
  const { middleware } = await import("./middleware");
  return middleware(new NextRequest(`https://wangstore.test${path}`));
}

describe("middleware mode pemeliharaan", () => {
  it("meneruskan halaman ketika mode dinonaktifkan", async () => {
    const response = await run("/server-builder", false);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("mengalihkan halaman publik ke halaman pemeliharaan", async () => {
    const response = await run("/server-builder?from=test", true);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://wangstore.test/maintenance");
  });

  it("mengembalikan 503 JSON untuk API yang diblokir", async () => {
    const response = await run("/api/orders", true);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "MAINTENANCE" });
  });

  it("tetap mengizinkan callback autentikasi dan melindungi halaman admin", async () => {
    const callback = await run("/auth/callback?code=contoh", true);
    expect(callback.headers.get("x-middleware-next")).toBe("1");
    const admin = await run("/admin", true);
    expect(admin.status).toBe(307);
    expect(admin.headers.get("location")).toBe("https://wangstore.test/login?next=%2Fadmin");
  });
});

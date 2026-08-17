import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/types";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn(), changePassword: vi.fn() };
});
vi.mock("@/lib/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repository")>();
  return { ...actual, audit: vi.fn() };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, enforceRateLimit: vi.fn() };
});

import { changePassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const user: SessionUser = { id: "customer-password", email: "pelanggan@example.test", name: "Pelanggan", role: "customer", emailVerified: true };
const requireUserMock = vi.mocked(requireUser);
const changePasswordMock = vi.mocked(changePassword);
const auditMock = vi.mocked(audit);
const rateLimitMock = vi.mocked(enforceRateLimit);

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue(user);
  changePasswordMock.mockReset().mockResolvedValue(undefined);
  auditMock.mockReset().mockResolvedValue(undefined);
  rateLimitMock.mockReset().mockResolvedValue(undefined);
});

describe("POST perubahan kata sandi", () => {
  it("mempertahankan karakter opak dan membatasi percobaan per akun", async () => {
    const currentPassword = "Lama<>&'\"123A";
    const newPassword = "Baru<>&'\"456B";
    const response = await POST(new Request("https://wangstore.test/api/account/password", {
      method: "POST",
      headers: { host: "wangstore.test", origin: "https://wangstore.test", "content-type": "application/json", "x-forwarded-for": "192.0.2.9" },
      body: JSON.stringify({ currentPassword, newPassword })
    }));

    expect(response.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "account:password", userId: user.id, ip: "192.0.2.9" }));
    expect(changePasswordMock).toHaveBeenCalledWith(user, currentPassword, newPassword);
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: user.id, action: "change_password", ip: "192.0.2.9" }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { LocalUserRecord } from "@/lib/db/local";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet, set: vi.fn(), delete: vi.fn() }))
}));
vi.mock("@/lib/db/supabase", () => ({
  isSupabaseConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(),
  getSupabasePublic: vi.fn()
}));
vi.mock("@/lib/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repository")>();
  return { ...actual, findLocalUserById: vi.fn() };
});

import { findLocalUserById } from "@/lib/db/repository";
import { getSessionUser } from "./index";

const findUserMock = vi.mocked(findLocalUserById);
const secret = "session-test-secret-with-at-least-32-characters";
const stored: LocalUserRecord = {
  id: "account-session",
  email: "account@example.test",
  name: "Akun Terkini",
  whatsapp: "628123456789",
  passwordHash: "hash",
  role: "customer",
  emailVerified: true,
  verificationTokenHash: null,
  resetTokenHash: null,
  resetExpiresAt: null,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z"
};

async function sessionToken(): Promise<string> {
  return new SignJWT({ email: stored.email, name: "Nama Lama", role: "owner", emailVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(stored.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

beforeEach(async () => {
  process.env.JWT_SECRET = secret;
  cookieGet.mockReset().mockReturnValue({ value: await sessionToken() });
  findUserMock.mockReset().mockResolvedValue(stored);
});

describe("revalidasi sesi", () => {
  it("menggunakan peran dan profil terkini, bukan klaim JWT lama", async () => {
    await expect(getSessionUser()).resolves.toEqual({
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: "customer",
      emailVerified: true
    });
  });

  it("menolak sesi akun yang tidak lagi terverifikasi", async () => {
    findUserMock.mockResolvedValue({ ...stored, emailVerified: false });
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("menolak sesi ketika akun telah dihapus", async () => {
    findUserMock.mockResolvedValue(null);
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

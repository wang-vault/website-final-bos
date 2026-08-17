import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceRenewalRecord, SessionUser } from "@/types";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireRole: vi.fn() };
});
vi.mock("@/lib/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repository")>();
  return { ...actual, completeServiceRenewal: vi.fn() };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, enforceRateLimit: vi.fn() };
});

import { AuthError, requireRole } from "@/lib/auth";
import { completeServiceRenewal } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const requireRoleMock = vi.mocked(requireRole);
const completeRenewalMock = vi.mocked(completeServiceRenewal);
const rateLimitMock = vi.mocked(enforceRateLimit);
const context = { params: Promise.resolve({ id: "renewal-route-test" }) };

function user(role: SessionUser["role"]): SessionUser {
  return { id: `${role}-route-test`, role, email: `${role}@example.test`, name: role, emailVerified: true };
}

function request(body: unknown): Request {
  return new Request("http://localhost:3000/api/admin/renewals/renewal-route-test/confirm", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", origin: "http://localhost:3000" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  requireRoleMock.mockReset();
  completeRenewalMock.mockReset();
  rateLimitMock.mockReset().mockResolvedValue(undefined);
});

describe("POST konfirmasi pembayaran perpanjangan", () => {
  it("menolak permintaan tanpa autentikasi", async () => {
    requireRoleMock.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Silakan masuk untuk melanjutkan.", 401));

    const response = await POST(request({ paymentReference: "PAY-001", reason: "Pembayaran sudah diverifikasi." }), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "UNAUTHENTICATED" });
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
    expect(completeRenewalMock).not.toHaveBeenCalled();
  });

  it("menolak staf yang tidak memenuhi peran admin", async () => {
    requireRoleMock.mockRejectedValue(new AuthError("FORBIDDEN", "Anda tidak memiliki izin untuk tindakan ini.", 403));

    const response = await POST(request({ paymentReference: "PAY-002", reason: "Pembayaran sudah diverifikasi." }), context);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(completeRenewalMock).not.toHaveBeenCalled();
  });

  it("mengizinkan admin dan meneruskan identitas aktor ke transaksi", async () => {
    const admin = user("admin");
    const renewal: ServiceRenewalRecord = {
      id: "renewal-route-test",
      serviceId: "service-route-test",
      orderId: "RNW-ROUTE-TEST",
      duration: 30,
      oldExpiresAt: "2026-08-01T00:00:00.000Z",
      newExpiresAt: "2026-09-01T00:00:00.000Z",
      price: 45_000,
      status: "completed",
      paymentReference: "PAY-003",
      createdAt: "2026-08-01T00:00:00.000Z",
      completedAt: "2026-08-17T00:00:00.000Z"
    };
    requireRoleMock.mockResolvedValue(admin);
    completeRenewalMock.mockResolvedValue(renewal);

    const response = await POST(request({ paymentReference: " PAY-003 ", reason: " Pembayaran sudah diverifikasi. " }), context);

    expect(response.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "admin:renewals:confirm", userId: admin.id }));
    expect(completeRenewalMock).toHaveBeenCalledWith(expect.objectContaining({
      renewalId: renewal.id,
      actorId: admin.id,
      paymentReference: "PAY-003",
      reason: "Pembayaran sudah diverifikasi."
    }));
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { renewal } });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord, SessionUser } from "@/types";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireRole: vi.fn() };
});
vi.mock("@/lib/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repository")>();
  return { ...actual, transitionOrderStatus: vi.fn(), audit: vi.fn() };
});
vi.mock("@/lib/cms/admin-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/admin-repository")>();
  return { ...actual, adminUpdate: vi.fn(), adminDelete: vi.fn() };
});

import { AuthError, requireRole } from "@/lib/auth";
import { adminUpdate } from "@/lib/cms/admin-repository";
import { audit, transitionOrderStatus } from "@/lib/db/repository";
import { PATCH } from "./route";

const requireRoleMock = vi.mocked(requireRole);
const transitionMock = vi.mocked(transitionOrderStatus);
const adminUpdateMock = vi.mocked(adminUpdate);
const auditMock = vi.mocked(audit);
const context = { params: Promise.resolve({ resource: "orders", id: "ORDER-ROUTE-001" }) };

function user(role: SessionUser["role"]): SessionUser {
  return { id: `${role}-order-route`, role, email: `${role}@example.test`, name: role, emailVerified: true };
}

function request(body: unknown): Request {
  return new Request("http://localhost:3000/api/admin/orders/ORDER-ROUTE-001", {
    method: "PATCH",
    headers: { "content-type": "application/json", host: "localhost:3000", origin: "http://localhost:3000" },
    body: JSON.stringify(body)
  });
}

const transitionedOrder = {
  id: "ORDER-ROUTE-001",
  status: "paid",
  paymentReference: "PAY-ORDER-001"
} as OrderRecord;

beforeEach(() => {
  requireRoleMock.mockReset();
  transitionMock.mockReset().mockResolvedValue({ order: transitionedOrder, service: null });
  adminUpdateMock.mockReset();
  auditMock.mockReset();
});

describe("PATCH transaksi status pesanan admin", () => {
  it("menolak pengguna tanpa izin sebelum transaksi dipanggil", async () => {
    requireRoleMock.mockRejectedValue(new AuthError("FORBIDDEN", "Anda tidak memiliki izin untuk tindakan ini.", 403));

    const response = await PATCH(request({
      status: "paid",
      paymentReference: "PAY-ORDER-001",
      reason: "Pembayaran sudah diverifikasi."
    }), context);

    expect(response.status).toBe(403);
    expect(requireRoleMock).toHaveBeenCalledWith("staff");
    expect(transitionMock).not.toHaveBeenCalled();
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it("mengizinkan Staff dan meneruskan aktor serta data pembayaran ke transaksi resmi", async () => {
    const staff = user("staff");
    requireRoleMock.mockResolvedValue(staff);

    const response = await PATCH(request({
      status: "paid",
      paymentReference: "PAY-ORDER-001",
      reason: "Pembayaran sudah diverifikasi."
    }), context);

    expect(response.status).toBe(200);
    expect(transitionMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "ORDER-ROUTE-001",
      status: "paid",
      paymentReference: "PAY-ORDER-001",
      reason: "Pembayaran sudah diverifikasi.",
      actorId: staff.id
    }));
    expect(adminUpdateMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("menolak payload pembayaran yang tidak memenuhi validasi", async () => {
    requireRoleMock.mockResolvedValue(user("admin"));

    const response = await PATCH(request({ status: "paid", paymentReference: null, reason: "x" }), context);

    expect(response.status).toBe(422);
    expect(transitionMock).not.toHaveBeenCalled();
  });
});

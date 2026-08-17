import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderRecord } from "@/types";

const directory = path.join(process.cwd(), "data", `vitest-order-transition-${process.pid}-${randomUUID()}`);
let local: typeof import("@/lib/db/local");
let repository: typeof import("@/lib/db/repository");

beforeAll(async () => {
  process.env.WANGSTORE_LOCAL_DATA_DIR = directory;
  [local, repository] = await Promise.all([import("@/lib/db/local"), import("@/lib/db/repository")]);
  await local.updateLocalState((state) => {
    state.users.push({
      id: "customer-order-transition",
      email: "pelanggan@example.test",
      name: "Pelanggan Pengujian",
      whatsapp: "+628123456789",
      passwordHash: "hash-for-test-only",
      role: "customer",
      emailVerified: true,
      verificationTokenHash: null,
      resetTokenHash: null,
      resetExpiresAt: null,
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z"
    });
  });
});

afterAll(async () => {
  await fs.rm(directory, { recursive: true, force: true });
  delete process.env.WANGSTORE_LOCAL_DATA_DIR;
});

function order(id: string, customerId: string | null = "customer-order-transition"): OrderRecord {
  return {
    id,
    customerId,
    name: "Pelanggan Pengujian",
    whatsapp: "+628123456789",
    email: "pelanggan@example.test",
    serverName: "Server Pengujian",
    note: "",
    tier: "low",
    packageId: null,
    cpu: 2,
    ram: 4,
    storage: 20,
    subtotal: 45_000,
    couponCode: null,
    discount: 0,
    total: 45_000,
    status: "pending",
    paymentReference: null,
    accessTokenHash: "hash-for-test-only",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z"
  };
}

async function transition(orderId: string, status: OrderRecord["status"], paymentReference: string | null = null) {
  return repository.transitionOrderStatus({
    orderId,
    status,
    paymentReference,
    reason: "Pembayaran telah diverifikasi oleh petugas.",
    actorId: "admin-order-transition",
    ip: "127.0.0.1",
    at: new Date("2026-08-17T12:00:00.000Z")
  });
}

describe("transaksi status dan provisioning pesanan", () => {
  it("membuat tepat satu layanan, notifikasi, dan audit ketika pesanan memasuki status dibayar", async () => {
    const pendingOrder = order("ORDER-PROVISION-001");
    await local.updateLocalState((state) => state.orders.push(pendingOrder));

    const first = await transition(pendingOrder.id, "paid", " MANUAL-ORDER-001 ");
    expect(first.order).toMatchObject({ status: "paid", paymentReference: "MANUAL-ORDER-001" });
    expect(first.service).toMatchObject({
      customerId: pendingOrder.customerId,
      orderId: pendingOrder.id,
      productId: "prod-minecraft-low",
      status: "active",
      activationAt: "2026-08-17T12:00:00.000Z",
      expiresAt: "2026-09-16T12:00:00.000Z",
      price: pendingOrder.subtotal
    });

    const repeated = await transition(pendingOrder.id, "paid", "MANUAL-ORDER-001");
    expect(repeated.service?.id).toBe(first.service?.id);

    const state = await local.readLocalState();
    expect(state.services.filter((item) => item.orderId === pendingOrder.id)).toHaveLength(1);
    expect(state.notifications.filter((item) => item.serviceId === first.service?.id)).toHaveLength(1);
    expect(state.audits.filter((item) => item.action === "confirm_payment" && item.resourceId === pendingOrder.id)).toHaveLength(1);
  });

  it("menolak konfirmasi tanpa referensi pembayaran tanpa meninggalkan perubahan parsial", async () => {
    const pendingOrder = order("ORDER-NO-REFERENCE");
    await local.updateLocalState((state) => state.orders.push(pendingOrder));

    await expect(transition(pendingOrder.id, "paid", "  ")).rejects.toMatchObject({
      code: "PAYMENT_REFERENCE_REQUIRED",
      status: 422
    });
    const state = await local.readLocalState();
    expect(state.orders.find((item) => item.id === pendingOrder.id)?.status).toBe("pending");
    expect(state.services.some((item) => item.orderId === pendingOrder.id)).toBe(false);
    expect(state.notifications.some((item) => item.message.includes(pendingOrder.id))).toBe(false);
    expect(state.audits.some((item) => item.resourceId === pendingOrder.id)).toBe(false);
  });

  it("menolak pesanan tamu atau pelanggan yang tidak terdaftar", async () => {
    const guestOrder = order("ORDER-GUEST", null);
    const orphanOrder = order("ORDER-ORPHAN", "customer-does-not-exist");
    await local.updateLocalState((state) => state.orders.push(guestOrder, orphanOrder));

    for (const item of [guestOrder, orphanOrder]) {
      await expect(transition(item.id, "paid", `MANUAL-${item.id}`)).rejects.toMatchObject({
        code: "ORDER_CUSTOMER_REQUIRED",
        status: 409
      });
    }
    const state = await local.readLocalState();
    expect(state.services.some((item) => [guestOrder.id, orphanOrder.id].includes(item.orderId))).toBe(false);
  });

  it("menolak transisi status yang tidak valid dan status lanjutan tanpa layanan", async () => {
    const pendingOrder = order("ORDER-INVALID-TRANSITION");
    const legacyPaidOrder = { ...order("ORDER-LEGACY-PAID"), status: "paid" as const };
    await local.updateLocalState((state) => state.orders.push(pendingOrder, legacyPaidOrder));

    await expect(transition(pendingOrder.id, "completed")).rejects.toMatchObject({ code: "ORDER_TRANSITION", status: 409 });
    await expect(transition(legacyPaidOrder.id, "processing")).rejects.toMatchObject({ code: "ORDER_SERVICE_REQUIRED", status: 409 });

    const state = await local.readLocalState();
    expect(state.orders.find((item) => item.id === pendingOrder.id)?.status).toBe("pending");
    expect(state.orders.find((item) => item.id === legacyPaidOrder.id)?.status).toBe("paid");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const directory = path.join(process.cwd(), "data", `vitest-${process.pid}`);
let repository: typeof import("@/lib/db/repository");

beforeAll(async () => {
  process.env.WANGSTORE_LOCAL_DATA_DIR = directory;
  repository = await import("@/lib/db/repository");
  const local = await import("@/lib/db/local");
  await Promise.all(Array.from({ length: 8 }, () => local.readLocalState()));
  await local.updateLocalState((state) => {
    state.services.push(
      { id: "service-reminder", customerId: "customer-reminder", orderId: "order-reminder", productId: "product", packageId: null, serviceType: "minecraft", status: "active", activationAt: "2026-08-01T12:00:00.000Z", expiresAt: "2026-08-20T12:00:00.000Z", renewable: true, price: 45_000, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z" },
      { id: "service-cancelled", customerId: "customer-reminder", orderId: "order-cancelled", productId: "product", packageId: null, serviceType: "minecraft", status: "cancelled", activationAt: "2026-08-01T12:00:00.000Z", expiresAt: "2026-08-16T12:00:00.000Z", renewable: false, price: 45_000, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z" },
      { id: "service-scheduled", customerId: "customer-reminder", orderId: "order-scheduled", productId: "product", packageId: null, serviceType: "minecraft", status: "scheduled", activationAt: "2026-08-18T12:00:00.000Z", expiresAt: "2026-08-30T12:00:00.000Z", renewable: true, price: 45_000, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z" }
    );
  });
});

afterAll(async () => { await fs.rm(directory, { recursive: true, force: true }); });

describe("idempotensi reminder", () => {
  it("tidak membuat notifikasi kedua untuk layanan dan interval yang sama", async () => {
    const first = await repository.runServiceReminders(new Date("2026-08-17T12:00:00.000Z"));
    const second = await repository.runServiceReminders(new Date("2026-08-17T12:05:00.000Z"));
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect((await repository.listNotifications("customer-reminder")).filter((item) => item.serviceId === "service-reminder")).toHaveLength(1);
  });

  it("menyamakan status lokal dengan waktu server dan menangani jadwal yang terlambat", async () => {
    await repository.runServiceReminders(new Date("2026-08-22T12:00:00.000Z"));
    await expect(repository.getService("service-reminder")).resolves.toMatchObject({ status: "expired" });
    await expect(repository.getService("service-scheduled")).resolves.toMatchObject({ status: "active" });
    await expect(repository.getService("service-cancelled")).resolves.toMatchObject({ status: "cancelled" });
    expect((await repository.listNotifications("customer-reminder")).filter((item) => item.serviceId === "service-reminder")).toHaveLength(2);
    expect((await repository.listNotifications("customer-reminder")).filter((item) => item.serviceId === "service-cancelled")).toHaveLength(0);
  });

  it("mengirim interval yang sama lagi setelah siklus perpanjangan baru", async () => {
    const local = await import("@/lib/db/local");
    await local.updateLocalState((state) => {
      const service = state.services.find((item) => item.id === "service-reminder");
      if (!service) throw new Error("Layanan uji tidak ditemukan.");
      service.status = "active";
      service.expiresAt = "2026-09-01T12:00:00.000Z";
      service.updatedAt = "2026-08-29T12:00:00.000Z";
    });

    await repository.runServiceReminders(new Date("2026-08-29T12:00:00.000Z"));
    await repository.runServiceReminders(new Date("2026-08-29T12:05:00.000Z"));
    expect((await repository.listNotifications("customer-reminder")).filter((item) => item.serviceId === "service-reminder")).toHaveLength(3);
  });
});

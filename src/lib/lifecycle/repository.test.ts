import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateRenewalWindow } from "./index";
import { priceConfiguration, PricingError } from "@/lib/pricing";
import type { ServiceRecord } from "@/types";

const directory = path.join(process.cwd(), "data", `vitest-lifecycle-${process.pid}-${randomUUID()}`);
let local: typeof import("@/lib/db/local");
let repository: typeof import("@/lib/db/repository");
let admin: typeof import("@/lib/cms/admin-repository");

beforeAll(async () => {
  process.env.WANGSTORE_LOCAL_DATA_DIR = directory;
  [local, repository, admin] = await Promise.all([
    import("@/lib/db/local"),
    import("@/lib/db/repository"),
    import("@/lib/cms/admin-repository")
  ]);
});

afterAll(async () => {
  await fs.rm(directory, { recursive: true, force: true });
  delete process.env.WANGSTORE_LOCAL_DATA_DIR;
});

function service(id: string, status: ServiceRecord["status"], activationAt: string, expiresAt: string): ServiceRecord {
  return {
    id,
    customerId: "customer-lifecycle",
    orderId: `order-${id}`,
    productId: "product-lifecycle",
    packageId: null,
    serviceType: "minecraft",
    status,
    activationAt,
    expiresAt,
    renewable: true,
    price: 45_000,
    createdAt: activationAt,
    updatedAt: activationAt
  };
}

describe("transisi katalog Medium", () => {
  it("hanya membuka pemesanan ketika produk dan paket sama-sama available", async () => {
    const packageData = {
      id: "medium-2c4g",
      tier: "medium",
      name: "Medium 2 Core 4 GB",
      cpu: 2,
      ram: 4,
      storage: 40,
      price: 175_000,
      status: "available",
      popular: false
    } as const;
    await admin.adminCreate("packages", packageData);

    expect(await repository.listMediumPackages()).toEqual([]);
    expect(() => priceConfiguration({ tier: "medium", packageId: packageData.id, cpu: 99, ram: 99, storage: 99 }, [])).toThrowError(PricingError);

    const mediumProduct = (await local.readLocalState()).products.find((item) => item.tier === "medium");
    expect(mediumProduct).toBeDefined();
    await admin.adminUpdate("products", mediumProduct?.slug ?? "minecraft-medium", { ...mediumProduct, status: "available" });

    const available = await repository.listMediumPackages();
    expect(available).toHaveLength(1);
    expect(priceConfiguration({ tier: "medium", packageId: packageData.id, cpu: 99, ram: 99, storage: 99 }, available)).toEqual({
      config: { tier: "medium", packageId: packageData.id, cpu: 2, ram: 4, storage: 40 },
      price: 175_000
    });

    await admin.adminUpdate("packages", packageData.id, { ...packageData, status: "maintenance" });
    expect(await repository.listMediumPackages()).toEqual([]);

    await admin.adminUpdate("packages", packageData.id, packageData);
    await admin.adminUpdate("products", mediumProduct?.slug ?? "minecraft-medium", { ...mediumProduct, status: "maintenance" });
    expect(await repository.listMediumPackages()).toEqual([]);
  });
});

describe("konfirmasi renewal", () => {
  it("tidak mengubah masa layanan sebelum konfirmasi dan memperpanjang secara atomik setelah konfirmasi", async () => {
    const active = service("service-active", "active", "2026-08-01T12:00:00.000Z", "2026-09-16T12:00:00.000Z");
    const expired = service("service-expired", "expired", "2026-07-01T12:00:00.000Z", "2026-08-16T12:00:00.000Z");
    await local.updateLocalState((state) => state.services.push(active, expired));

    const requestedAt = new Date("2026-08-17T12:00:00.000Z");
    const activeWindow = calculateRenewalWindow(active.expiresAt, 30, requestedAt);
    const activeRenewal = await repository.createRenewal({
      service: active,
      customerId: active.customerId,
      duration: 30,
      oldExpiresAt: active.expiresAt,
      newExpiresAt: activeWindow.expiresAt,
      price: active.price,
      ip: "127.0.0.1"
    });

    expect((await repository.getService(active.id))?.expiresAt).toBe(active.expiresAt);
    await expect(repository.createRenewal({
      service: active,
      customerId: active.customerId,
      duration: 30,
      oldExpiresAt: active.expiresAt,
      newExpiresAt: activeWindow.expiresAt,
      price: active.price,
      ip: "127.0.0.1"
    })).rejects.toMatchObject({ code: "RENEWAL_PENDING" });

    const confirmedActive = await repository.completeServiceRenewal({
      renewalId: activeRenewal.id,
      actorId: "admin-lifecycle",
      ip: "127.0.0.1",
      paymentReference: "MANUAL-ACTIVE-001",
      reason: "Pembayaran manual telah diverifikasi.",
      at: requestedAt
    });
    expect(confirmedActive.status).toBe("completed");
    expect(confirmedActive.newExpiresAt).toBe("2026-10-16T12:00:00.000Z");
    expect((await repository.getService(active.id))?.expiresAt).toBe("2026-10-16T12:00:00.000Z");

    const expiredWindow = calculateRenewalWindow(expired.expiresAt, 30, requestedAt);
    const expiredRenewal = await repository.createRenewal({
      service: expired,
      customerId: expired.customerId,
      duration: 30,
      oldExpiresAt: expired.expiresAt,
      newExpiresAt: expiredWindow.expiresAt,
      price: expired.price,
      ip: "127.0.0.1"
    });
    await repository.completeServiceRenewal({
      renewalId: expiredRenewal.id,
      actorId: "admin-lifecycle",
      ip: "127.0.0.1",
      paymentReference: "MANUAL-EXPIRED-001",
      reason: "Pembayaran manual telah diverifikasi.",
      at: requestedAt
    });
    const renewedExpiredService = await repository.getService(expired.id);
    expect(renewedExpiredService?.activationAt).toBe(requestedAt.toISOString());
    expect(renewedExpiredService?.expiresAt).toBe("2026-09-16T12:00:00.000Z");
    expect(renewedExpiredService?.status).toBe("active");

    await repository.completeServiceRenewal({
      renewalId: activeRenewal.id,
      actorId: "admin-lifecycle",
      ip: "127.0.0.1",
      paymentReference: "MANUAL-ACTIVE-001",
      reason: "Percobaan ulang konfirmasi yang sama.",
      at: requestedAt
    });
    const state = await local.readLocalState();
    expect(state.audits.filter((item) => item.action === "confirm" && item.resourceId === activeRenewal.id)).toHaveLength(1);
  });

  it("mempertahankan suspensi dan menolak layanan yang dibatalkan atau dihentikan", async () => {
    const confirmedAt = new Date("2026-08-17T14:00:00.000Z");
    const suspended = service("service-suspended", "suspended", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    const toCancel = service("service-to-cancel", "active", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    const toTerminate = service("service-to-terminate", "active", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    await local.updateLocalState((state) => state.services.push(suspended, toCancel, toTerminate));

    async function pendingRenewal(item: ServiceRecord) {
      const window = calculateRenewalWindow(item.expiresAt, 30, confirmedAt);
      return repository.createRenewal({
        service: item,
        customerId: item.customerId,
        duration: 30,
        oldExpiresAt: item.expiresAt,
        newExpiresAt: window.expiresAt,
        price: item.price,
        ip: "127.0.0.1"
      });
    }

    const suspendedRenewal = await pendingRenewal(suspended);
    const cancelledRenewal = await pendingRenewal(toCancel);
    const terminatedRenewal = await pendingRenewal(toTerminate);
    await local.updateLocalState((state) => {
      const cancelled = state.services.find((item) => item.id === toCancel.id);
      const terminated = state.services.find((item) => item.id === toTerminate.id);
      if (cancelled) cancelled.status = "cancelled";
      if (terminated) terminated.status = "terminated";
    });

    await repository.completeServiceRenewal({
      renewalId: suspendedRenewal.id,
      actorId: "admin-lifecycle",
      ip: "127.0.0.1",
      paymentReference: "MANUAL-SUSPENDED-001",
      reason: "Pembayaran manual telah diverifikasi.",
      at: confirmedAt
    });
    expect((await repository.getService(suspended.id))?.status).toBe("suspended");
    expect((await repository.getService(suspended.id))?.expiresAt).toBe("2026-10-01T00:00:00.000Z");

    for (const renewal of [cancelledRenewal, terminatedRenewal]) {
      await expect(repository.completeServiceRenewal({
        renewalId: renewal.id,
        actorId: "admin-lifecycle",
        ip: "127.0.0.1",
        paymentReference: `MANUAL-${renewal.id}`,
        reason: "Konfirmasi harus ditolak karena status layanan.",
        at: confirmedAt
      })).rejects.toMatchObject({ code: "INVALID_STATUS", status: 409 });
    }

    const state = await local.readLocalState();
    expect(state.serviceRenewals.find((item) => item.id === cancelledRenewal.id)?.status).toBe("pending");
    expect(state.serviceRenewals.find((item) => item.id === terminatedRenewal.id)?.status).toBe("pending");
    expect(state.audits.filter((item) => item.action === "confirm" && [cancelledRenewal.id, terminatedRenewal.id].includes(item.resourceId ?? ""))).toHaveLength(0);
  });
});

describe("kontrol siklus hidup layanan admin", () => {
  it("mempertahankan tanggal dan hanya mengubah status serta kebijakan perpanjangan", async () => {
    const activationAt = new Date(Date.now() - 86_400_000).toISOString();
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const active = service("service-admin-active", "active", activationAt, expiresAt);
    await local.updateLocalState((state) => state.services.push(active));

    await admin.adminUpdate("services", active.id, {
      status: "suspended",
      renewable: false,
      reason: "Layanan ditangguhkan atas permintaan pelanggan.",
      activationAt: "2035-01-01T00:00:00.000Z",
      durationDays: 365
    });

    const updated = await repository.getService(active.id);
    expect(updated).toMatchObject({ status: "suspended", renewable: false, activationAt, expiresAt });
  });

  it("menolak aktivasi ulang layanan kedaluwarsa dan layanan terminal", async () => {
    const pastActivation = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const pastExpiration = new Date(Date.now() - 86_400_000).toISOString();
    const expiredSuspension = service("service-admin-expired-suspension", "suspended", pastActivation, pastExpiration);
    const cancelled = service("service-admin-cancelled", "cancelled", pastActivation, pastExpiration);
    const terminated = service("service-admin-terminated", "terminated", pastActivation, pastExpiration);
    await local.updateLocalState((state) => state.services.push(expiredSuspension, cancelled, terminated));

    await expect(admin.adminUpdate("services", expiredSuspension.id, {
      status: "active",
      renewable: true,
      reason: "Mencoba mengaktifkan kembali layanan kedaluwarsa."
    })).rejects.toMatchObject({ code: "SERVICE_RENEWAL_REQUIRED", status: 409 });

    for (const terminal of [cancelled, terminated]) {
      await expect(admin.adminUpdate("services", terminal.id, {
        status: "active",
        renewable: true,
        reason: "Mencoba mengaktifkan kembali layanan terminal."
      })).rejects.toMatchObject({ code: "SERVICE_TERMINAL", status: 409 });
    }
  });
});

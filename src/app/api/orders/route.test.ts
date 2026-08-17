import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord, Product, SessionUser } from "@/types";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});
vi.mock("@/lib/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repository")>();
  return {
    ...actual,
    createOrder: vi.fn(),
    getProductByTier: vi.fn(),
    getSetting: vi.fn(),
    listMediumPackages: vi.fn()
  };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, enforceRateLimit: vi.fn() };
});
vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return { ...actual, verifyTurnstile: vi.fn() };
});

import { AuthError, requireUser } from "@/lib/auth";
import { createOrder, getProductByTier, getSetting, listMediumPackages } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/security";
import { POST } from "./route";

const requireUserMock = vi.mocked(requireUser);
const createOrderMock = vi.mocked(createOrder);
const getProductMock = vi.mocked(getProductByTier);
const getSettingMock = vi.mocked(getSetting);
const listMediumPackagesMock = vi.mocked(listMediumPackages);
const rateLimitMock = vi.mocked(enforceRateLimit);
const turnstileMock = vi.mocked(verifyTurnstile);

const customer: SessionUser = {
  id: "customer-order-route",
  role: "customer",
  email: "pelanggan@example.test",
  name: "Pelanggan Uji",
  emailVerified: true
};
const product: Product = {
  id: "product-low-route",
  name: "Minecraft Hosting Low",
  slug: "minecraft-low",
  description: "Konfigurasi khusus.",
  tier: "low",
  serviceType: "minecraft",
  status: "available",
  visibility: true,
  renewable: true,
  metadata: {}
};
const order: OrderRecord = {
  id: "WS-ROUTE-TEST",
  customerId: customer.id,
  name: customer.name,
  whatsapp: "628123456789",
  email: customer.email,
  serverName: "Server Uji",
  note: "",
  tier: "low",
  packageId: null,
  cpu: 2,
  ram: 4,
  storage: 20,
  subtotal: 45_000,
  discount: 0,
  total: 45_000,
  couponCode: null,
  status: "pending",
  paymentReference: null,
  accessTokenHash: "hash-rahasia",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z"
};

function request(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000"
    },
    body: JSON.stringify({
      name: customer.name,
      whatsapp: order.whatsapp,
      email: customer.email,
      serverName: order.serverName,
      note: "",
      coupon: "",
      tier: "low",
      packageId: null,
      cpu: 2,
      ram: 4,
      storage: 20,
      acceptedPolicy: true,
      clientPrice: 1,
      ...overrides
    })
  });
}

beforeEach(() => {
  requireUserMock.mockReset();
  createOrderMock.mockReset();
  getProductMock.mockReset().mockResolvedValue(product);
  getSettingMock.mockReset().mockResolvedValue("");
  listMediumPackagesMock.mockReset().mockResolvedValue([]);
  rateLimitMock.mockReset().mockResolvedValue(undefined);
  turnstileMock.mockReset().mockResolvedValue(undefined);
});

describe("POST pembuatan pesanan", () => {
  it("menolak pengunjung tanpa membuat pesanan", async () => {
    requireUserMock.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Silakan masuk untuk melanjutkan.", 401));

    const response = await POST(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "UNAUTHENTICATED" });
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("mengaitkan pesanan dan pembatasan laju dengan akun yang masuk", async () => {
    requireUserMock.mockResolvedValue(customer);
    createOrderMock.mockResolvedValue({ order, accessToken: "token-akses" });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(rateLimitMock).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "orders:create",
      userId: customer.id
    }));
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      customerId: customer.id,
      subtotal: 45_000,
      configuration: expect.objectContaining({ tier: "low", cpu: 2, ram: 4, storage: 20 })
    }));
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      data: {
        order: { id: order.id, customerId: customer.id },
        confirmationUrl: `/order/${order.id}?token=token-akses`
      }
    });
    expect(payload.data.order).not.toHaveProperty("accessTokenHash");
  });

  it("meneruskan token Turnstile sebagai nilai opak tanpa mengubahnya", async () => {
    requireUserMock.mockResolvedValue(customer);
    createOrderMock.mockResolvedValue({ order, accessToken: "token-akses" });
    const opaqueToken = "  token<bagian>\u0007.dengan-spasi  ";

    const response = await POST(request({ turnstileToken: opaqueToken }));

    expect(response.status).toBe(201);
    expect(turnstileMock).toHaveBeenCalledWith(opaqueToken, expect.any(String));
  });

  it("mengembalikan 409 ketika produk Medium belum tersedia", async () => {
    requireUserMock.mockResolvedValue(customer);
    getProductMock.mockResolvedValue({ ...product, id: "product-medium", tier: "medium", slug: "minecraft-medium", status: "ongoing" });

    const response = await POST(request({ tier: "medium", packageId: "medium-2c4g" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "TIER_ONGOING" });
    expect(listMediumPackagesMock).not.toHaveBeenCalled();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("memakai harga dan spesifikasi katalog saat Medium tersedia", async () => {
    requireUserMock.mockResolvedValue(customer);
    getProductMock.mockResolvedValue({ ...product, id: "product-medium", tier: "medium", slug: "minecraft-medium", status: "available" });
    listMediumPackagesMock.mockResolvedValue([{ id: "medium-2c4g", tier: "medium", name: "Medium 2C4G", cpu: 2, ram: 4, storage: 30, price: 150_000, status: "available", popular: false }]);
    createOrderMock.mockResolvedValue({ order: { ...order, tier: "medium", packageId: "medium-2c4g", storage: 30, subtotal: 150_000, total: 150_000 }, accessToken: "token-medium" });

    const response = await POST(request({ tier: "medium", packageId: "medium-2c4g", cpu: 99, ram: 99, storage: 99, clientPrice: 1 }));

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      subtotal: 150_000,
      configuration: { tier: "medium", packageId: "medium-2c4g", cpu: 2, ram: 4, storage: 30 }
    }));
  });

  it("menolak ID paket Medium palsu dengan 422 tanpa membuat pesanan", async () => {
    requireUserMock.mockResolvedValue(customer);
    getProductMock.mockResolvedValue({ ...product, id: "product-medium", tier: "medium", slug: "minecraft-medium", status: "available" });
    listMediumPackagesMock.mockResolvedValue([{ id: "medium-2c4g", tier: "medium", name: "Medium 2C4G", cpu: 2, ram: 4, storage: 30, price: 150_000, status: "available", popular: false }]);

    const response = await POST(request({ tier: "medium", packageId: "medium-palsu", cpu: 2, ram: 4, storage: 30 }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "INVALID_PACKAGE" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});

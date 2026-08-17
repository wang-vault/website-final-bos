import { describe, expect, it } from "vitest";
import { resourceMap } from "./resources";

describe("kebijakan peran sumber daya administrasi", () => {
  it("membatasi dokumen hukum dan testimoni terverifikasi kepada Pemilik", () => {
    expect(resourceMap.legal.minimumRole).toBe("owner");
    expect(resourceMap.testimonials.minimumRole).toBe("owner");
  });

  it("mengizinkan Admin mengelola pemeliharaan dan membaca audit", () => {
    expect(resourceMap.maintenance.minimumRole).toBe("admin");
    expect(resourceMap.audit.minimumRole).toBe("admin");
  });

  it("membatasi Staf pada sumber daya operasional yang ditetapkan", () => {
    expect(resourceMap.orders.minimumRole).toBe("staff");
    expect(resourceMap.tickets.minimumRole).toBe("staff");
    expect(resourceMap.products.minimumRole).toBe("admin");
  });

  it("menolak perubahan tanggal dan harga layanan melalui PATCH admin", () => {
    const accepted = resourceMap.services.schema.safeParse({
      status: "suspended",
      renewable: false,
      reason: "Layanan ditangguhkan atas permintaan pelanggan."
    });
    const forbidden = resourceMap.services.schema.safeParse({
      status: "active",
      renewable: true,
      reason: "Mencoba memperpanjang masa secara langsung.",
      activationAt: "2030-01-01T00:00:00.000Z",
      durationDays: 365,
      price: 1
    });

    expect(accepted.success).toBe(true);
    expect(forbidden.success).toBe(false);
  });
});

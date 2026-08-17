import { describe, expect, it } from "vitest";
import { HIGH_PACKAGES, calculateLowPrice, normalizeLow, priceConfiguration } from "./index";

describe("pricing WangStore", () => {
  it("menghasilkan seluruh harga paket High secara tepat", () => {
    expect(HIGH_PACKAGES.map((item) => item.price)).toEqual([300000, 420000, 600000, 850000, 1100000, 2100000]);
  });
  it("menerapkan harga minimum Low", () => {
    expect(calculateLowPrice({ cpu: 2, ram: 4, storage: 20 })).toBe(45000);
  });
  it("memangkas konfigurasi Low yang melampaui batas", () => {
    expect(normalizeLow({ cpu: 20, ram: 64, storage: 900 })).toEqual({ cpu: 16, ram: 32, storage: 160 });
  });
  it("menolak Medium tanpa menghasilkan harga nol", () => {
    expect(() => priceConfiguration({ tier: "medium", cpu: 2, ram: 4, storage: 20 })).toThrow("belum tersedia");
  });
  it("menggunakan paket Medium yang tersedia dari katalog resmi", () => {
    const packages = [{ id: "medium-2c4g", tier: "medium" as const, name: "Medium 2C4G", cpu: 2, ram: 4, storage: 30, price: 150000, status: "available" as const, popular: false }];
    expect(priceConfiguration({ tier: "medium", packageId: "medium-2c4g", cpu: 99, ram: 99, storage: 99 }, packages)).toMatchObject({ price: 150000, config: { cpu: 2, ram: 4, storage: 30 } });
    expect(() => priceConfiguration({ tier: "medium", packageId: "fake", cpu: 2, ram: 4, storage: 30 }, packages)).toThrow("tidak tersedia");
  });
  it("menolak package High palsu", () => {
    expect(() => priceConfiguration({ tier: "high", packageId: "fake", cpu: 2, ram: 4, storage: 20 })).toThrow("tidak valid");
  });
});

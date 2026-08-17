import { describe, expect, it } from "vitest";
import { calculateRenewalWindow, effectiveServiceStatus } from "./index";

const now = new Date("2026-08-17T12:00:00.000Z");
describe("lifecycle layanan", () => {
  it("menjadwalkan aktivasi masa depan", () => expect(effectiveServiceStatus("pending", "2026-08-18T12:00:00Z", "2026-09-18T12:00:00Z", now)).toBe("scheduled"));
  it("mengaktifkan layanan yang waktunya tiba", () => expect(effectiveServiceStatus("pending", "2026-08-16T12:00:00Z", "2026-09-16T12:00:00Z", now)).toBe("active"));
  it("menandai layanan lewat waktu sebagai expired", () => expect(effectiveServiceStatus("active", "2026-07-16T12:00:00Z", "2026-08-16T12:00:00Z", now)).toBe("expired"));
  it("menandai layanan ditangguhkan sebagai expired ketika masanya berakhir", () => expect(effectiveServiceStatus("suspended", "2026-07-16T12:00:00Z", "2026-08-16T12:00:00Z", now)).toBe("expired"));
  it("mempertahankan penangguhan sebelum masa layanan berakhir", () => expect(effectiveServiceStatus("suspended", "2026-07-16T12:00:00Z", "2026-09-16T12:00:00Z", now)).toBe("suspended"));
  it("mempertahankan sisa masa saat renewal layanan aktif", () => expect(calculateRenewalWindow("2026-09-16T12:00:00Z", 30, now).expiresAt).toBe("2026-10-16T12:00:00.000Z"));
  it("memulai masa baru dari waktu server untuk layanan expired", () => expect(calculateRenewalWindow("2026-08-16T12:00:00Z", 30, now).expiresAt).toBe("2026-09-16T12:00:00.000Z"));
});

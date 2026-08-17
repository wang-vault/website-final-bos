import { describe, expect, it } from "vitest";
import { isAllowedDuringMaintenance } from "./maintenance";

describe("jalur mode pemeliharaan", () => {
  it.each(["/maintenance", "/status", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/auth/callback", "/admin", "/admin/orders", "/api/admin/orders", "/api/cron/reminders"])("selalu mengizinkan jalur operasional %s", (path) => {
    expect(isAllowedDuringMaintenance(path, [])).toBe(true);
  });

  it("mengizinkan jalur tambahan dan turunannya tanpa kecocokan awalan yang longgar", () => {
    expect(isAllowedDuringMaintenance("/knowledge-base/article", ["/knowledge-base"])).toBe(true);
    expect(isAllowedDuringMaintenance("/knowledge-base-other", ["/knowledge-base"])).toBe(false);
  });

  it("menolak jalur publik biasa saat tidak dikecualikan", () => {
    expect(isAllowedDuringMaintenance("/server-builder", ["/status"])).toBe(false);
    expect(isAllowedDuringMaintenance("/api/orders", ["/status"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { assertTrustedOrigin, readJsonBody, sanitizeUnknownExcept, SecurityError } from "./index";

describe("batas keamanan request", () => {
  it("menolak origin lintas situs", () => {
    const request = new Request("https://wangstore.test/api/orders", { headers: { host: "wangstore.test", origin: "https://penyerang.test" } });
    expect(() => assertTrustedOrigin(request)).toThrowError(SecurityError);
  });

  it("menerima origin yang sama", () => {
    const request = new Request("https://wangstore.test/api/orders", { headers: { host: "wangstore.test", origin: "https://wangstore.test" } });
    expect(() => assertTrustedOrigin(request)).not.toThrow();
  });

  it("menolak body yang melampaui batas", async () => {
    const request = new Request("https://wangstore.test/api", { method: "POST", body: JSON.stringify({ value: "panjang" }) });
    await expect(readJsonBody(request, 4)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413 });
  });

  it("tidak mengubah kata sandi dan token opak saat membersihkan kolom lain", () => {
    const password = "Rahasia<>&'\"123A";
    const token = "opaque<token>&value";
    expect(sanitizeUnknownExcept({ name: " <b>Ayu</b> ", password, nested: { token, label: " <i>Aman</i> " } }, ["password", "token"]))
      .toEqual({ name: "bAyu/b", password, nested: { token, label: "iAman/i" } });
  });
});

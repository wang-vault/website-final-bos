import { expect, it } from "vitest";
import type { OrderRecord, TicketRecord } from "@/types";
import { toOrderView, toTicketView } from "./projections";

const order: OrderRecord = {
  id: "WS-PROJECTION",
  customerId: "customer",
  name: "Pelanggan",
  whatsapp: "628123456789",
  email: "pelanggan@example.test",
  serverName: "Server",
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

it("menghapus hash token akses dari proyeksi pesanan", () => {
  expect(toOrderView(order)).not.toHaveProperty("accessTokenHash");
});

it("hanya memproyeksikan kolom tiket yang diizinkan", () => {
  const ticket = {
    id: "TKT-PROJECTION",
    customerId: "customer",
    name: "Pelanggan",
    email: "pelanggan@example.test",
    subject: "Pertanyaan",
    message: "Mohon bantuan untuk layanan.",
    status: "open",
    priority: "normal",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    turnstileToken: "token-rahasia"
  } as TicketRecord & { turnstileToken: string };

  expect(toTicketView(ticket)).not.toHaveProperty("turnstileToken");
});

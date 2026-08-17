import type { OrderRecord } from "@/types";
import { formatRupiah } from "@/lib/pricing";

export const PURCHASE_WARNING = "Pastikan konfigurasi Anda sudah benar sebelum melakukan pembayaran. Pembelian bersifat final sesuai kebijakan WangStore. Jika ragu, konsultasikan terlebih dahulu.";

export function normalizeWhatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function orderMessage(order: Pick<OrderRecord, "id" | "name" | "whatsapp" | "email" | "tier" | "packageId" | "cpu" | "ram" | "storage" | "subtotal" | "couponCode" | "discount" | "total">): string {
  return [
    "Halo WangStore, saya ingin melanjutkan pesanan berikut:", "",
    `Nama: ${order.name}`, `WhatsApp: ${order.whatsapp}`, `Email: ${order.email}`, `ID Pesanan: ${order.id}`,
    `Tier: ${order.tier.toUpperCase()}`, `Paket: ${order.packageId ?? "Konfigurasi Khusus"}`,
    `CPU: ${order.cpu} inti`, `RAM: ${order.ram} GB`, `Penyimpanan: ${order.storage} GB`,
    `Harga: ${formatRupiah(order.subtotal)}`, `Kupon: ${order.couponCode ?? "Tidak digunakan"}`,
    `Diskon: ${formatRupiah(order.discount)}`, `Total: ${formatRupiah(order.total)}`, "", PURCHASE_WARNING,
    "Saya telah memeriksa konfigurasi dan menyetujui Ketentuan, Kebijakan Pengembalian Dana, serta SLA WangStore."
  ].join("\n");
}

export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${normalizeWhatsappNumber(number)}?text=${encodeURIComponent(message)}`;
}

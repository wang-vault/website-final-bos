import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)); }
export function formatDate(value: string): string { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
export function readingTime(content: string): number { return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200)); }

const statusLabels: Readonly<Record<string, string>> = {
  active: "Aktif",
  admin: "Administrator",
  available: "Tersedia",
  awaiting_payment: "Menunggu pembayaran",
  cancelled: "Dibatalkan",
  closed: "Ditutup",
  customer: "Pelanggan",
  completed: "Selesai",
  critical: "Kritis",
  draft: "Draf",
  expired: "Kedaluwarsa",
  high: "Tinggi",
  identified: "Teridentifikasi",
  inactive: "Nonaktif",
  in_progress: "Dalam proses",
  investigating: "Dalam investigasi",
  low: "Rendah",
  maintenance: "Pemeliharaan",
  major: "Besar",
  minor: "Kecil",
  monitoring: "Dalam pemantauan",
  none: "Tidak ada",
  normal: "Normal",
  ongoing: "Dalam persiapan",
  open: "Terbuka",
  owner: "Pemilik",
  paid: "Dibayar",
  pending: "Menunggu",
  processing: "Diproses",
  published: "Diterbitkan",
  refunded: "Dikembalikan",
  resolved: "Terselesaikan",
  scheduled: "Terjadwal",
  sent: "Terkirim",
  sold_out: "Habis",
  staff: "Staf",
  suspended: "Ditangguhkan",
  terminated: "Dihentikan",
};

export function formatStatus(value: string): string {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

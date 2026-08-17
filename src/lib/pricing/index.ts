import type { CatalogPackage, Tier } from "@/types";

export const LOW_LIMITS = {
  cpu: { min: 2, max: 16, step: 1 },
  ram: { min: 4, max: 32, step: 2 },
  storage: { min: 20, max: 160, step: 10 }
} as const;

export const LOW_PRICING = {
  base: 5_000,
  perCore: 7_000,
  perGbRam: 4_500,
  perGbStorage: 300,
  rounding: 500,
  minimum: 45_000
} as const;

export const TIER_DEFINITIONS = {
  low: { label: "Low", processor: "Intel Xeon E5-2690 v4", mode: "custom", status: "available", perfFactor: 0.82 },
  medium: { label: "Medium", processor: "Intel Xeon Gold 6138", mode: "package", status: "ongoing", perfFactor: 1 },
  high: { label: "High", processor: "AMD Ryzen 9 9950X", mode: "package", status: "available", perfFactor: 1.45 }
} as const;

export const HIGH_PACKAGES = [
  { id: "high-2c4g", cpu: 2, ram: 4, storage: 30, price: 300_000 },
  { id: "high-3c6g", cpu: 3, ram: 6, storage: 40, price: 420_000 },
  { id: "high-4c8g", cpu: 4, ram: 8, storage: 50, price: 600_000, popular: true },
  { id: "high-6c12g", cpu: 6, ram: 12, storage: 60, price: 850_000 },
  { id: "high-8c16g", cpu: 8, ram: 16, storage: 70, price: 1_100_000 },
  { id: "high-10c32g", cpu: 10, ram: 32, storage: 110, price: 2_100_000 }
] as const;

export type HighPackageId = (typeof HIGH_PACKAGES)[number]["id"];
export interface Configuration { tier: Tier; cpu: number; ram: number; storage: number; packageId?: string | null }
export interface Estimate {
  tps: string;
  concurrentPlayers: string;
  cpuLoad: string;
  ramUsage: string;
  recommendedPlugins: string;
  grade: "A" | "B" | "C";
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, finite(value, min)));
  return Math.min(max, min + Math.round((clamped - min) / step) * step);
}

export function normalizeLow(input: Pick<Configuration, "cpu" | "ram" | "storage">): Pick<Configuration, "cpu" | "ram" | "storage"> {
  return {
    cpu: normalizeStep(input.cpu, LOW_LIMITS.cpu.min, LOW_LIMITS.cpu.max, LOW_LIMITS.cpu.step),
    ram: normalizeStep(input.ram, LOW_LIMITS.ram.min, LOW_LIMITS.ram.max, LOW_LIMITS.ram.step),
    storage: normalizeStep(input.storage, LOW_LIMITS.storage.min, LOW_LIMITS.storage.max, LOW_LIMITS.storage.step)
  };
}

export function calculateLowPrice(input: Pick<Configuration, "cpu" | "ram" | "storage">): number {
  const config = normalizeLow(input);
  const raw = LOW_PRICING.base
    + config.cpu * LOW_PRICING.perCore
    + config.ram * LOW_PRICING.perGbRam
    + config.storage * LOW_PRICING.perGbStorage;
  const rounded = Math.round(raw / LOW_PRICING.rounding) * LOW_PRICING.rounding;
  return Math.max(LOW_PRICING.minimum, rounded);
}

export function getHighPackage(packageId: string) {
  return HIGH_PACKAGES.find((item) => item.id === packageId);
}

export function priceConfiguration(input: Configuration, mediumPackages: readonly CatalogPackage[] = []): { config: Configuration; price: number } {
  if (input.tier === "medium") {
    const selected = input.packageId ? mediumPackages.find((item) => item.id === input.packageId && item.tier === "medium" && item.status === "available") : undefined;
    if (!selected) throw new PricingError(mediumPackages.length ? "INVALID_PACKAGE" : "TIER_ONGOING", mediumPackages.length ? "Paket Medium tidak valid atau tidak tersedia." : "Tier Medium belum tersedia untuk pemesanan.");
    return { config: { tier: "medium", packageId: selected.id, cpu: selected.cpu, ram: selected.ram, storage: selected.storage }, price: selected.price };
  }
  if (input.tier === "low") {
    const normalized = normalizeLow(input);
    return { config: { tier: "low", ...normalized, packageId: null }, price: calculateLowPrice(normalized) };
  }
  const selected = input.packageId ? getHighPackage(input.packageId) : undefined;
  if (!selected) throw new PricingError("INVALID_PACKAGE", "Paket High tidak valid.");
  return {
    config: { tier: "high", packageId: selected.id, cpu: selected.cpu, ram: selected.ram, storage: selected.storage },
    price: selected.price
  };
}

export function estimateConfiguration(input: Configuration, mediumPackages: readonly CatalogPackage[] = []): Estimate {
  const priced = priceConfiguration(input, mediumPackages);
  const factor = TIER_DEFINITIONS[priced.config.tier].perfFactor;
  const cpuScore = priced.config.cpu * factor;
  const ramScore = priced.config.ram * factor;
  const playersLow = Math.max(4, Math.floor(Math.min(cpuScore * 7, ramScore * 2.2)));
  const playersHigh = Math.max(playersLow + 3, Math.floor(Math.min(cpuScore * 11, ramScore * 3.2)));
  const baseLoad = Math.max(28, Math.min(82, Math.round(74 - cpuScore * 1.8 + playersHigh * 0.9)));
  const ramLow = Math.max(2, Math.round(priced.config.ram * 0.55));
  const ramHigh = Math.max(ramLow, Math.round(priced.config.ram * 0.78));
  const plugins = Math.max(5, Math.floor(Math.min(cpuScore * 5, ramScore * 2.5)));
  const score = cpuScore + ramScore / 3;
  return {
    tps: factor >= 1.4 && cpuScore >= 5 ? "19–20" : cpuScore >= 4 ? "18–20" : "17–20",
    concurrentPlayers: `${playersLow}–${playersHigh}`,
    cpuLoad: `${Math.max(20, baseLoad - 12)}–${baseLoad}%`,
    ramUsage: `${ramLow}–${ramHigh} GB`,
    recommendedPlugins: `hingga ${plugins} plugin ringan`,
    grade: score >= 14 ? "A" : score >= 7 ? "B" : "C"
  };
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export class PricingError extends Error {
  constructor(public readonly code: "TIER_ONGOING" | "INVALID_PACKAGE", message: string) {
    super(message);
    this.name = "PricingError";
  }
}

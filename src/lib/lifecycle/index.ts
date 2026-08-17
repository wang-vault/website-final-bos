import type { ServiceStatus } from "@/types";

export const RENEWAL_DURATIONS = [30, 90, 365] as const;
export type RenewalDuration = (typeof RENEWAL_DURATIONS)[number];

export function effectiveServiceStatus(
  status: ServiceStatus,
  activationAt: string,
  expiresAt: string,
  now = new Date()
): ServiceStatus {
  if (["cancelled", "terminated"].includes(status)) return status;
  if (new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  if (status === "suspended") return status;
  if (new Date(activationAt).getTime() > now.getTime()) return "scheduled";
  if (status === "pending" || status === "scheduled" || status === "expired") return "active";
  return status;
}

export function calculateRenewalWindow(expiresAt: string, durationDays: RenewalDuration, now = new Date()): {
  activationAt: string;
  expiresAt: string;
} {
  const currentExpiration = new Date(expiresAt);
  const base = currentExpiration.getTime() > now.getTime() ? currentExpiration : now;
  return {
    activationAt: currentExpiration.getTime() > now.getTime() ? now.toISOString() : now.toISOString(),
    expiresAt: new Date(base.getTime() + durationDays * 86_400_000).toISOString()
  };
}

export function remainingDuration(expiresAt: string, now = new Date()): string {
  const milliseconds = new Date(expiresAt).getTime() - now.getTime();
  if (milliseconds <= 0) return "Telah berakhir";
  const days = Math.ceil(milliseconds / 86_400_000);
  if (days === 1) return "1 hari";
  return `${days} hari`;
}

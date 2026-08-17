export interface MaintenanceState {
  enabled: boolean;
  title: string;
  message: string;
  estimatedRestoration: string | null;
  allowedPaths: string[];
}

const ALWAYS_ALLOWED = [
  "/maintenance",
  "/status",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/admin",
  "/api/admin",
  "/api/auth",
  "/api/status",
  "/api/maintenance-state",
  "/api/cron/reminders"
] as const;

function pathMatches(pathname: string, allowed: string): boolean {
  if (!allowed.startsWith("/")) return false;
  const normalized = allowed.length > 1 ? allowed.replace(/\/+$/, "") : allowed;
  return pathname === normalized || (normalized !== "/" && pathname.startsWith(`${normalized}/`));
}

export function isAllowedDuringMaintenance(pathname: string, configuredPaths: readonly string[]): boolean {
  return [...ALWAYS_ALLOWED, ...configuredPaths].some((allowed) => pathMatches(pathname, allowed));
}

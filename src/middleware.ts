import { NextResponse, type NextRequest } from "next/server";
import { isAllowedDuringMaintenance, type MaintenanceState } from "@/lib/maintenance";

interface MaintenanceResponse { success: boolean; data?: MaintenanceState }
let cachedMaintenance: { value: MaintenanceState; expiresAt: number } | null = null;

async function maintenanceState(request: NextRequest): Promise<MaintenanceState | null> {
  if (cachedMaintenance && cachedMaintenance.expiresAt > Date.now()) return cachedMaintenance.value;
  try {
    const response = await fetch(new URL("/api/maintenance-state", request.url), { cache: "no-store" });
    if (!response.ok) return null;
    const result = await response.json() as MaintenanceResponse;
    if (!result.success || !result.data) return null;
    cachedMaintenance = { value: result.data, expiresAt: Date.now() + 5_000 };
    return result.data;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path !== "/api/maintenance-state") {
    const maintenance = await maintenanceState(request);
    if (maintenance?.enabled && !isAllowedDuringMaintenance(path, maintenance.allowedPaths)) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ success: false, code: "MAINTENANCE", message: maintenance.message }, { status: 503, headers: { "retry-after": "60" } });
      }
      return NextResponse.redirect(new URL("/maintenance", request.url), 307);
    }
  }

  const session = request.cookies.get(process.env.SESSION_COOKIE_NAME ?? "wangstore_session")?.value;
  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};

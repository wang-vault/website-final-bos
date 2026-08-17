import { handleApiError, ok } from "@/lib/api";
import { audit, } from "@/lib/db/repository";
import { destroySession, getSessionUser } from "@/lib/auth";
import { assertTrustedOrigin, clientIp } from "@/lib/security";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await getSessionUser(); await destroySession(); await audit({ actorId: user?.id ?? null, action: "logout", resource: "session", resourceId: null, ip: clientIp(request), metadata: {} }); return ok({ redirectTo: "/" }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

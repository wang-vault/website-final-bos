import { handleApiError, ok } from "@/lib/api";
import { verifyLocalEmail } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security";
export async function GET(request: Request) { try { const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "auth:verify", limit: 10, windowSeconds: 3600 }); const token = new URL(request.url).searchParams.get("token"); if (!token || token.length < 20) throw new Error("Tautan verifikasi tidak valid."); await verifyLocalEmail(token); return ok({ message: "Email berhasil diverifikasi." }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

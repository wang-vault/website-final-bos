import { handleApiError, ok } from "@/lib/api";
import { register } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept, verifyTurnstile } from "@/lib/security";
import { registerSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "auth:register", limit: 4, windowSeconds: 3600 }); const input = registerSchema.parse(sanitizeUnknownExcept(await readJsonBody(request),["password","turnstileToken"])); await verifyTurnstile(input.turnstileToken, ip); const result = await register(input, ip); return ok({ message: "Pendaftaran berhasil. Periksa email untuk verifikasi sebelum masuk.", ...result }, 201); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

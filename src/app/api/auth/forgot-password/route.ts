import { handleApiError, ok } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept, verifyTurnstile } from "@/lib/security";
import { forgotSchema } from "@/lib/validation";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "auth:forgot", limit: 4, windowSeconds: 3600 }); const input = forgotSchema.parse(sanitizeUnknownExcept(await readJsonBody(request), ["turnstileToken"])); await verifyTurnstile(input.turnstileToken, ip); const { email } = input; const result = await requestPasswordReset(email); return ok({ message: "Jika akun tersedia, instruksi pemulihan akan dikirim.", ...result }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { resetPassword } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept } from "@/lib/security";
import { resetSchema } from "@/lib/validation";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "auth:reset", limit: 5, windowSeconds: 3600 }); const input = resetSchema.parse(sanitizeUnknownExcept(await readJsonBody(request),["token","password"])); await resetPassword(input.token, input.password); return ok({ message: "Kata sandi berhasil diperbarui." }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

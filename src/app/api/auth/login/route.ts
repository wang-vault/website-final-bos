import { handleApiError, ok } from "@/lib/api";
import { login } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept, verifyTurnstile } from "@/lib/security";
import { loginSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "auth:login", limit: 6, windowSeconds: 900 }); const input = loginSchema.parse(sanitizeUnknownExcept(await readJsonBody(request),["password","turnstileToken"])); await verifyTurnstile(input.turnstileToken, ip); const user = await login(input, ip); return ok({ user, redirectTo: user.role === "customer" ? "/dashboard" : "/admin" }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

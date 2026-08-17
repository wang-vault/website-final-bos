import { handleApiError, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { listMediumPackages, validateCouponCode } from "@/lib/db/repository";
import { priceConfiguration } from "@/lib/pricing";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";
import { couponValidationSchema } from "@/lib/validation";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await getSessionUser(); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "coupon:validate", userId: user?.id, limit: 20, windowSeconds: 600 }); const input = couponValidationSchema.parse(sanitizeUnknown(await readJsonBody(request))); const priced = priceConfiguration(input, input.tier === "medium" ? await listMediumPackages() : []); const result = await validateCouponCode(input.code, priced.price, input.tier, user?.id ?? ip); return ok({ ...result, subtotal: priced.price, total: priced.price - result.discount }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

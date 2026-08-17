import { handleApiError, fail, ok } from "@/lib/api";
import { getSessionUser, requireUser } from "@/lib/auth";
import { createOrder, getProductByTier, getSetting, listMediumPackages, listOrdersForUser } from "@/lib/db/repository";
import { priceConfiguration } from "@/lib/pricing";
import { toOrderView } from "@/lib/projections";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept, verifyTurnstile } from "@/lib/security";
import { orderSchema } from "@/lib/validation";
import { orderMessage, whatsappUrl } from "@/lib/whatsapp";
export const runtime = "nodejs";
export async function GET() {
  try { const user = await getSessionUser(); if (!user) return fail("UNAUTHENTICATED", "Silakan masuk untuk melihat pesanan.", 401); return ok({ orders: (await listOrdersForUser(user)).map(toOrderView) }); }
  catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requireUser();
    const ip = clientIp(request);
    await enforceRateLimit({ ip, endpoint: "orders:create", userId: user.id, limit: 8, windowSeconds: 600 });
    const parsed = orderSchema.parse(sanitizeUnknownExcept(await readJsonBody(request), ["turnstileToken"]));
    await verifyTurnstile(parsed.turnstileToken, ip);
    const product = await getProductByTier(parsed.tier);
    if (!product) return fail("UNKNOWN_TIER", "Tier tidak dikenali.", 422);
    if (parsed.tier === "medium" && product.status !== "available") return fail("TIER_ONGOING", "Paket Medium sedang dipersiapkan dan belum tersedia untuk pemesanan.", 409);
    if (product.status !== "available") return fail("PRODUCT_UNAVAILABLE", "Layanan sedang tidak tersedia untuk pemesanan.", 409);
    const mediumPackages = parsed.tier === "medium" ? await listMediumPackages() : [];
    const priced = priceConfiguration({ tier: parsed.tier, packageId: parsed.packageId, cpu: parsed.cpu, ram: parsed.ram, storage: parsed.storage }, mediumPackages);
    const created = await createOrder({ customerId: user.id, name: parsed.name, whatsapp: parsed.whatsapp, email: parsed.email, serverName: parsed.serverName, note: parsed.note, configuration: priced.config, subtotal: priced.price, couponCode: parsed.coupon ? parsed.coupon.toUpperCase() : null, ip });
    const number = await getSetting("whatsapp_number") || process.env.WHATSAPP_NUMBER || "";
    const url = whatsappUrl(number, orderMessage(created.order));
    return ok({ order: toOrderView(created.order), confirmationUrl: `/order/${created.order.id}?token=${encodeURIComponent(created.accessToken)}`, whatsappUrl: url }, 201);
  } catch (error) { return handleApiError(error); }
}
export const dynamic = "force-dynamic";

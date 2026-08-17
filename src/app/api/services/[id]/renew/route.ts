import { z } from "zod";
import { handleApiError, fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { canAccessCustomerResource } from "@/lib/auth/authorization";
import { createRenewal, getService } from "@/lib/db/repository";
import { calculateRenewalWindow, RENEWAL_DURATIONS, type RenewalDuration } from "@/lib/lifecycle";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody } from "@/lib/security";
const schema = z.object({ duration: z.number().int().refine((value) => (RENEWAL_DURATIONS as readonly number[]).includes(value), "Durasi perpanjangan tidak valid.") }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { assertTrustedOrigin(request); const user = await requireUser(); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "services:renew", userId: user.id, limit: 6, windowSeconds: 600 }); const { id } = await context.params; const service = await getService(id); if (!service) return fail("NOT_FOUND", "Layanan tidak ditemukan.", 404); if (!canAccessCustomerResource(user,service.customerId)) return fail("FORBIDDEN", "Anda tidak memiliki akses ke layanan ini.", 403); if (!service.renewable) return fail("NOT_RENEWABLE", "Layanan ini tidak dapat diperpanjang.", 409); if (["terminated", "cancelled"].includes(service.status)) return fail("INVALID_STATUS", "Status layanan tidak memenuhi syarat perpanjangan.", 409); const { duration } = schema.parse(await readJsonBody(request)); const window = calculateRenewalWindow(service.expiresAt, duration as RenewalDuration); const monthlyUnits = duration === 365 ? 12 : duration / 30; const price = Math.round(service.price * monthlyUnits); const renewal = await createRenewal({ service, customerId: user.id, duration, oldExpiresAt: service.expiresAt, newExpiresAt: window.expiresAt, price, ip }); return ok({ renewal, message: "Pesanan perpanjangan dibuat dengan status menunggu. Masa layanan belum berubah sampai pembayaran dikonfirmasi." }, 201); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { audit, createTicket } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknownExcept, verifyTurnstile } from "@/lib/security";
import { ticketSchema } from "@/lib/validation";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await getSessionUser(); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "contact:create", userId: user?.id, limit: 5, windowSeconds: 900 }); const input = ticketSchema.parse(sanitizeUnknownExcept(await readJsonBody(request), ["turnstileToken"])); await verifyTurnstile(input.turnstileToken, ip); const ticket = await createTicket({ name: input.name, email: input.email, subject: input.subject, message: input.message, customerId: user?.id ?? null }); await audit({ actorId: user?.id ?? null, action: "create", resource: "ticket", resourceId: ticket.id, ip, metadata: {} }); return ok({ ticketId: ticket.id, message: "Pesan diterima dan tercatat sebagai tiket." }, 201); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit, createTicket, listTickets } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { toTicketView } from "@/lib/projections";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";
import { ticketSchema } from "@/lib/validation";
export async function GET() { try { const user = await requireUser(); return ok({ tickets: (await listTickets(user)).map(toTicketView) }); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await requireUser(); const ip = clientIp(request); await enforceRateLimit({ ip, endpoint: "tickets:create", userId: user.id, limit: 8, windowSeconds: 3600 }); const input = ticketSchema.parse(sanitizeUnknown(await readJsonBody(request))); const ticket = await createTicket({ customerId: user.id, name: input.name, email: input.email, subject: input.subject, message: input.message }); await audit({ actorId: user.id, action: "create", resource: "ticket", resourceId: ticket.id, ip, metadata: {} }); return ok({ ticket: toTicketView(ticket) }, 201); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

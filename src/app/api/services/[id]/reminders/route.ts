import { handleApiError, fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { canAccessCustomerResource } from "@/lib/auth/authorization";
import { getService, listNotifications } from "@/lib/db/repository";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const { id } = await context.params; const service = await getService(id); if (!service) return fail("NOT_FOUND", "Layanan tidak ditemukan.", 404); if (!canAccessCustomerResource(user,service.customerId)) return fail("FORBIDDEN", "Anda tidak memiliki akses ke layanan ini.", 403); return ok({ reminders: (await listNotifications(service.customerId)).filter((item) => item.serviceId === id) }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

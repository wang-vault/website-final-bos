import { handleApiError, fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { canAccessCustomerResource } from "@/lib/auth/authorization";
import { getOrder, tokenMatchesHash } from "@/lib/db/repository";
import { toOrderView } from "@/lib/projections";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const order = await getOrder(id); if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.", 404);
    const user = await getSessionUser(); const token = new URL(request.url).searchParams.get("token");
    const allowed = (user && canAccessCustomerResource(user,order.customerId)) || (token && tokenMatchesHash(token,order.accessTokenHash));
    if (!allowed) return fail("FORBIDDEN", "Anda tidak memiliki akses ke pesanan ini.", 403);
    return ok({ order: toOrderView(order) });
  } catch (error) { return handleApiError(error); }
}
export const dynamic = "force-dynamic";

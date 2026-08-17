import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/db/repository";
import { toOrderView } from "@/lib/projections";
export async function GET() { try { const user = await requireUser(); return ok({ orders: (await listOrdersForUser(user)).map(toOrderView) }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/db/repository";
export async function GET() { try { const user = await requireUser(); return ok({ notifications: await listNotifications(user.id) }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

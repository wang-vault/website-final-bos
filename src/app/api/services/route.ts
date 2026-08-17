import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listServiceRenewals, listServices } from "@/lib/db/repository";
import { effectiveServiceStatus } from "@/lib/lifecycle";
export async function GET() { try { const user = await requireUser(); const [serviceRows, renewals] = await Promise.all([listServices(user), listServiceRenewals(user)]); const services = serviceRows.map((service) => ({ ...service, status: effectiveServiceStatus(service.status, service.activationAt, service.expiresAt) })); return ok({ services, renewals }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

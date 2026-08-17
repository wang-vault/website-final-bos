import { handleApiError,ok } from "@/lib/api";import { requireRole } from "@/lib/auth";import { listServices } from "@/lib/db/repository";import { effectiveServiceStatus } from "@/lib/lifecycle";
export async function GET(){try{const user=await requireRole("staff");const services=await listServices(user);return ok({services:services.map(item=>({...item,effectiveStatus:effectiveServiceStatus(item.status,item.activationAt,item.expiresAt)})),serverTime:new Date().toISOString()})}catch(error){return handleApiError(error)}}
export const dynamic = "force-dynamic";

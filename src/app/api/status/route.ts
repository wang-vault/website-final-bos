import { handleApiError,ok } from "@/lib/api";
import { getSetting,listPublicIncidents } from "@/lib/db/repository";
export async function GET(){try{const[enabled,title,message,estimatedRestoration,incidents]=await Promise.all([getSetting("maintenance_enabled"),getSetting("maintenance_title"),getSetting("maintenance_message"),getSetting("maintenance_restoration"),listPublicIncidents()]);const maintenance=enabled==="true";return ok({platform:maintenance?"maintenance":"available",monitoringConfigured:false,uptime:null,services:[],incidents,maintenance:maintenance?{title,message,estimatedRestoration:estimatedRestoration||null}:null,checkedAt:new Date().toISOString()})}catch(error){return handleApiError(error)}}
export const dynamic="force-dynamic";

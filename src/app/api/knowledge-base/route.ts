import { handleApiError,ok } from "@/lib/api";
import { listContent } from "@/lib/db/repository";
export async function GET(){try{return ok({articles:await listContent("knowledge")})}catch(error){return handleApiError(error)}}
export const dynamic="force-dynamic";

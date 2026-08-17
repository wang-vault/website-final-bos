import { handleApiError, ok } from "@/lib/api";
import { listMediumPackages } from "@/lib/db/repository";
import { HIGH_PACKAGES } from "@/lib/pricing";
export async function GET(){try{return ok({packages:{medium:await listMediumPackages(),high:HIGH_PACKAGES}})}catch(error){return handleApiError(error)}}
export const dynamic="force-dynamic";

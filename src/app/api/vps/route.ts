import { handleApiError, ok } from "@/lib/api";
import { listVpsLocations, listVpsPackages } from "@/lib/db/repository";
export async function GET() { try { return ok({ packages: await listVpsPackages(), locations: await listVpsLocations() }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

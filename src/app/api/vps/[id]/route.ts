import { handleApiError, fail, ok } from "@/lib/api";
import { listVpsPackages } from "@/lib/db/repository";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const item = (await listVpsPackages()).find((row) => row.id === id || row.slug === id); return item ? ok({ package: item }) : fail("NOT_FOUND", "Paket VPS tidak ditemukan.", 404); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

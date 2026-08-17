import { handleApiError, ok } from "@/lib/api";
import { listProducts } from "@/lib/db/repository";
export const runtime = "nodejs";
export async function GET() { try { return ok({ products: await listProducts() }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

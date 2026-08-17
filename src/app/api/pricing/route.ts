import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { listMediumPackages } from "@/lib/db/repository";
import { estimateConfiguration, HIGH_PACKAGES, LOW_LIMITS, LOW_PRICING, priceConfiguration, TIER_DEFINITIONS } from "@/lib/pricing";
export const runtime = "nodejs";
const schema = z.object({ tier: z.enum(["low", "medium", "high"]), packageId: z.string().nullable().optional(), cpu: z.coerce.number().finite(), ram: z.coerce.number().finite(), storage: z.coerce.number().finite() });
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mediumPackages = await listMediumPackages();
    if (!url.searchParams.has("tier")) return ok({ mediumPackages, tiers: TIER_DEFINITIONS, lowLimits: LOW_LIMITS, lowPricing: LOW_PRICING, highPackages: HIGH_PACKAGES });
    const input = schema.parse(Object.fromEntries(url.searchParams));
    const priced = priceConfiguration(input, mediumPackages);
    return ok({ ...priced, estimate: estimateConfiguration(priced.config, mediumPackages) });
  } catch (error) { return handleApiError(error); }
}
export const dynamic = "force-dynamic";

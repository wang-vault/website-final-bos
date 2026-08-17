import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audit, listMediumPackages, listSavedConfigurations, saveConfiguration } from "@/lib/db/repository";
import { priceConfiguration } from "@/lib/pricing";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";
import { savedConfigurationSchema } from "@/lib/validation";
export async function GET() { try { const user = await requireUser(); return ok({ configurations: await listSavedConfigurations(user.id) }); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await requireUser(); const input = savedConfigurationSchema.parse(sanitizeUnknown(await readJsonBody(request))); const mediumPackages = input.tier === "medium" ? await listMediumPackages() : []; const priced = priceConfiguration(input, mediumPackages); const record = await saveConfiguration(user.id, priced.config, input.name); await audit({ actorId: user.id, action: "create", resource: "saved_configuration", resourceId: record.id, ip: clientIp(request), metadata: { tier: record.tier } }); return ok({ configuration: record }, 201); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

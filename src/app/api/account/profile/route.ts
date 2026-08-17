import { handleApiError, ok } from "@/lib/api";
import { requireUser, updateProfile } from "@/lib/auth";
import { audit } from "@/lib/db/repository";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";
import { profileSchema } from "@/lib/validation";
export async function GET() { try { return ok({ user: await requireUser() }); } catch (error) { return handleApiError(error); } }
export async function PATCH(request: Request) { try { assertTrustedOrigin(request); const user = await requireUser(); const values = profileSchema.parse(sanitizeUnknown(await readJsonBody(request))); const updated = await updateProfile(user, values); await audit({ actorId: user.id, action: "update", resource: "profile", resourceId: user.id, ip: clientIp(request), metadata: {} }); return ok({ user: updated, message: "Profil berhasil diperbarui." }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

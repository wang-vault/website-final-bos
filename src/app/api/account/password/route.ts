import { handleApiError, ok } from "@/lib/api";
import { changePassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody } from "@/lib/security";
import { changePasswordSchema } from "@/lib/validation";
export async function POST(request: Request) { try { assertTrustedOrigin(request); const user = await requireUser(); const ip=clientIp(request); await enforceRateLimit({ip,endpoint:"account:password",userId:user.id,limit:5,windowSeconds:3600}); const input = changePasswordSchema.parse(await readJsonBody(request)); await changePassword(user, input.currentPassword, input.newPassword); await audit({ actorId: user.id, action: "change_password", resource: "user", resourceId: user.id, ip, metadata: {} }); return ok({ message: "Kata sandi berhasil diubah." }); } catch (error) { return handleApiError(error); } }
export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { completeServiceRenewal } from "@/lib/db/repository";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";

const schema = z.object({
  paymentReference: z.string().trim().min(3).max(160),
  reason: z.string().trim().min(5).max(500)
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const user = await requireRole("admin");
    const ip = clientIp(request);
    await enforceRateLimit({ ip, endpoint: "admin:renewals:confirm", userId: user.id, limit: 20, windowSeconds: 600 });
    const { id } = await context.params;
    const input = schema.parse(sanitizeUnknown(await readJsonBody(request)));
    const renewal = await completeServiceRenewal({ renewalId: id, actorId: user.id, ip, ...input });
    return ok({ renewal, message: "Pembayaran perpanjangan dikonfirmasi dan masa layanan telah diperpanjang." });
  } catch (error) {
    return handleApiError(error);
  }
}

export const dynamic = "force-dynamic";

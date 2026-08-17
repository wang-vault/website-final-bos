import { handleApiError, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { adminDelete, adminUpdate } from "@/lib/cms/admin-repository";
import { isResourceName, resourceMap } from "@/lib/cms/resources";
import { audit, transitionOrderStatus } from "@/lib/db/repository";
import { assertTrustedOrigin, clientIp, readJsonBody, sanitizeUnknown } from "@/lib/security";
import type { OrderRecord } from "@/types";

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const { resource, id } = await context.params;
    if (!isResourceName(resource)) return fail("NOT_FOUND", "Data admin tidak ditemukan.", 404);
    const definition = resourceMap[resource];
    const user = await requireRole(definition.minimumRole);
    const input = definition.schema.parse(sanitizeUnknown(await readJsonBody(request, 128 * 1024))) as Record<string, unknown>;
    const ip = clientIp(request);

    if (resource === "orders") {
      await transitionOrderStatus({
        orderId: id,
        status: input.status as OrderRecord["status"],
        paymentReference: input.paymentReference ? String(input.paymentReference) : null,
        reason: String(input.reason),
        actorId: user.id,
        ip
      });
      return ok({ id });
    }

    await adminUpdate(resource, id, input);
    await audit({
      actorId: user.id,
      action: "update",
      resource,
      resourceId: id,
      ip,
      metadata: resource === "services" ? { reason: String(input.reason) } : {}
    });
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const { resource, id } = await context.params;
    if (!isResourceName(resource)) return fail("NOT_FOUND", "Data admin tidak ditemukan.", 404);
    const definition = resourceMap[resource];
    if (definition.readOnly || definition.deleteDisabled) return fail("READ_ONLY", "Data ini tidak dapat dihapus.", 405);
    const user = await requireRole(definition.minimumRole);
    await adminDelete(resource, id);
    await audit({ actorId: user.id, action: "delete", resource, resourceId: id, ip: clientIp(request), metadata: {} });
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

export const dynamic = "force-dynamic";

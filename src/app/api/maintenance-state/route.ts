import { handleApiError, ok } from "@/lib/api";
import { getSetting } from "@/lib/db/repository";

export async function GET() {
  try {
    const [enabled, title, message, estimatedRestoration, allowedPaths] = await Promise.all([
      getSetting("maintenance_enabled"),
      getSetting("maintenance_title"),
      getSetting("maintenance_message"),
      getSetting("maintenance_restoration"),
      getSetting("maintenance_allowed_paths")
    ]);
    return ok({
      enabled: enabled === "true",
      title: title || "Pemeliharaan Terjadwal",
      message: message || "Platform sedang menjalani pemeliharaan. Silakan kembali beberapa saat lagi.",
      estimatedRestoration: estimatedRestoration || null,
      allowedPaths: allowedPaths.split(",").map((path) => path.trim()).filter((path) => path.startsWith("/"))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const dynamic = "force-dynamic";

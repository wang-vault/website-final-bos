const INTERNAL_ORIGIN = "https://internal.wangstore.invalid";

/**
 * Returns a normalized same-origin path, or null when the value could be
 * interpreted as a network-path or cross-origin URL by a browser.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN || !parsed.pathname.startsWith("/")) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

import { createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/db/supabase";

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Terlalu banyak permintaan. Silakan coba lagi nanti.");
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(input: { ip: string; endpoint: string; userId?: string | null; limit: number; windowSeconds: number }): Promise<void> {
  const salt = process.env.RATE_LIMIT_SALT ?? "wangstore-local-development";
  const rawKey = `${input.ip}:${input.endpoint}:${input.userId ?? "guest"}`;
  const key = createHash("sha256").update(`${salt}:${rawKey}`).digest("hex");
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin().rpc("consume_rate_limit", {
      p_key: key, p_limit: input.limit, p_window_seconds: input.windowSeconds
    });
    if (error) throw error;
    const allowed = Boolean((data as { allowed?: boolean } | null)?.allowed ?? data);
    if (!allowed) throw new RateLimitError(input.windowSeconds);
    return;
  }
  const currentTime = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= currentTime) {
    buckets.set(key, { count: 1, resetAt: currentTime + input.windowSeconds * 1000 });
    return;
  }
  if (bucket.count >= input.limit) throw new RateLimitError(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)));
  bucket.count += 1;
}

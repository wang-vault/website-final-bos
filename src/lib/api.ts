import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { RepositoryError } from "@/lib/db/repository";
import { PricingError } from "@/lib/pricing";
import { RateLimitError } from "@/lib/rate-limit";
import { SecurityError } from "@/lib/security";

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiFailure { success: false; error: true; code: string; message: string }

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}
export function fail(code: string, message: string, status: number): NextResponse<ApiFailure> {
  return NextResponse.json({ success: false, error: true, code, message }, { status });
}
export function handleApiError(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ZodError) return fail("VALIDATION_ERROR", error.issues[0]?.message ?? "Data tidak valid.", 422);
  if (error instanceof AuthError || error instanceof SecurityError) return fail(error.code, error.message, error.status);
  if (error instanceof RateLimitError) {
    const response = fail("RATE_LIMITED", error.message, 429);
    response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  if (error instanceof PricingError) return fail(error.code, error.message, error.code === "TIER_ONGOING" ? 409 : 422);
  if (error instanceof RepositoryError) return fail(error.code, error.message, error.status);
  console.error("API_ERROR", error instanceof Error ? error.message : "Unknown error");
  return fail("INTERNAL_ERROR", "Permintaan tidak dapat diproses saat ini.", 500);
}

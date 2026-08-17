import { headers } from "next/headers";
import { z } from "zod";

export const MAX_JSON_BODY = 32 * 1024;

export class SecurityError extends Error {
  constructor(public readonly code: "PAYLOAD_TOO_LARGE" | "CSRF_REJECTED" | "INVALID_JSON", message: string, public readonly status: number) {
    super(message);
    this.name = "SecurityError";
  }
}

export async function readJsonBody(request: Request, maximumBytes = MAX_JSON_BODY): Promise<unknown> {
  const announced = Number(request.headers.get("content-length") ?? 0);
  if (announced > maximumBytes) throw new SecurityError("PAYLOAD_TOO_LARGE", "Ukuran permintaan melampaui batas.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new SecurityError("PAYLOAD_TOO_LARGE", "Ukuran permintaan melampaui batas.", 413);
  try { return JSON.parse(text) as unknown; }
  catch { throw new SecurityError("INVALID_JSON", "Format JSON tidak valid.", 400); }
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowedUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originHost = new URL(origin).host;
  const allowedHost = allowedUrl ? new URL(allowedUrl).host : requestHost;
  if (!requestHost || (originHost !== requestHost && originHost !== allowedHost)) {
    throw new SecurityError("CSRF_REJECTED", "Permintaan lintas asal ditolak.", 403);
  }
}

export function sanitizeText(value: string): string {
  return value.replaceAll("\0", "").replace(/[<>]/g, "").trim();
}

export function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeUnknown);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeUnknown(child)]));
  }
  return value;
}

export function sanitizeUnknownExcept(value:unknown,excludedKeys:readonly string[]):unknown{
  const excluded=new Set(excludedKeys);
  function visit(item:unknown):unknown{
    if(typeof item==="string")return sanitizeText(item);
    if(Array.isArray(item))return item.map(visit);
    if(item!==null&&typeof item==="object")return Object.fromEntries(Object.entries(item).map(([key,child])=>[key,excluded.has(key)?child:visit(child)]));
    return item;
  }
  return visit(value);
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function serverClientIp(): Promise<string> {
  const values = await headers();
  return values.get("cf-connecting-ip") ?? values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const emailSchema = z.string().trim().toLowerCase().email("Alamat email tidak valid.").max(254);
export const passwordSchema = z.string().min(10, "Kata sandi minimal 10 karakter.").max(128)
  .regex(/[a-z]/, "Kata sandi harus memuat huruf kecil.")
  .regex(/[A-Z]/, "Kata sandi harus memuat huruf kapital.")
  .regex(/[0-9]/, "Kata sandi harus memuat angka.");

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new SecurityError("CSRF_REJECTED", "Verifikasi keamanan diperlukan.", 403);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    cache: "no-store"
  });
  const result = await response.json() as { success?: boolean };
  if (!response.ok || !result.success) throw new SecurityError("CSRF_REJECTED", "Verifikasi keamanan tidak valid atau kedaluwarsa.", 403);
}

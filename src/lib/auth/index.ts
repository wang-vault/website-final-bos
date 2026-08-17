import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role, SessionUser } from "@/types";
import { hasMinimumRole } from "./authorization";
import {
  audit,
  createLocalUser,
  findLocalUserByEmail,
  findLocalUserById,
  findLocalUserByToken,
  hashToken,
  makeToken,
  updateLocalUser
} from "@/lib/db/repository";
import { getSupabaseAdmin, getSupabasePublic, isSupabaseConfigured } from "@/lib/db/supabase";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const DUMMY_HASH = "$2b$12$Qqf1iSsxzCpgqxJDpWB7P.5.nbb2TKDduJd2yZ6M.VFEK5kYyXGXS";

function secret(): Uint8Array {
  const configured = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("JWT_SECRET untuk lingkungan produksi minimal 32 karakter.");
  return new TextEncoder().encode(configured ?? "wangstore-local-development-secret-change-me");
}
function cookieName(): string { return process.env.SESSION_COOKIE_NAME ?? "wangstore_session"; }
function validRole(value:unknown):value is Role{return typeof value==="string"&&(["owner","admin","staff","customer"] satisfies Role[]).includes(value as Role)}
async function loadCurrentUser(id:string):Promise<SessionUser|null>{
  if(!isSupabaseConfigured()){
    const user=await findLocalUserById(id);
    if(!user?.emailVerified)return null;
    return{id:user.id,email:user.email,name:user.name,role:user.role,emailVerified:true};
  }
  const{data,error}=await getSupabaseAdmin().from("users").select("id,email,email_verified,disabled_at,profiles(name,roles(name))").eq("id",id).maybeSingle();
  if(error||!data||data.disabled_at||data.email_verified!==true)return null;
  const profiles=data.profiles as unknown;
  const profile=Array.isArray(profiles)?profiles[0]:profiles as {name?:unknown;roles?:unknown}|null;
  const roles=profile?.roles;
  const roleRelation=Array.isArray(roles)?roles[0]:roles as {name?:unknown}|null;
  if(!profile||typeof profile.name!=="string"||!validRole(roleRelation?.name))return null;
  return{id:String(data.id),email:String(data.email),name:profile.name,role:roleRelation.name,emailVerified:true};
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).sign(secret());
  const store = await cookies();
  store.set(cookieName(), token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_MAX_AGE, path: "/" });
}

export async function destroySession(): Promise<void> {
  (await cookies()).set(cookieName(), "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), path: "/" });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string" || typeof payload.role !== "string") return null;
    if (!(["owner", "admin", "staff", "customer"] satisfies Role[]).includes(payload.role as Role)) return null;
    return await loadCurrentUser(payload.sub);
  } catch { return null; }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Silakan masuk untuk melanjutkan.", 401);
  return user;
}
export async function requireRole(minimum: "staff" | "admin" | "owner"): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasMinimumRole(user.role, minimum)) throw new AuthError("FORBIDDEN", "Anda tidak memiliki izin untuk tindakan ini.", 403);
  return user;
}

export async function register(input: { name: string; email: string; whatsapp: string; password: string }, ip: string): Promise<{ verificationPath: string | null }> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabasePublic().auth.signUp({ email: input.email, password: input.password, options: { data: { name: input.name, whatsapp: input.whatsapp }, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback` } });
    if (error || !data.user) throw new AuthError("REGISTER_FAILED", "Pendaftaran tidak dapat diproses. Periksa data atau coba lagi nanti.", 400);
    await getSupabaseAdmin().from("profiles").upsert({ id: data.user.id, name: input.name, whatsapp: input.whatsapp });
    await audit({ actorId: data.user.id, action: "register", resource: "user", resourceId: data.user.id, ip, metadata: {} });
    return { verificationPath: null };
  }
  const existing = await findLocalUserByEmail(input.email);
  if (existing) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new AuthError("REGISTER_FAILED", "Pendaftaran tidak dapat diproses. Periksa data atau coba lagi nanti.", 400);
  }
  const id = randomUUID();
  const token = makeToken();
  const timestamp = new Date().toISOString();
  await createLocalUser({ id, email: input.email, name: input.name, whatsapp: input.whatsapp, passwordHash: await bcrypt.hash(input.password, 12), role: "customer", emailVerified: false, verificationTokenHash: hashToken(token), resetTokenHash: null, resetExpiresAt: null, createdAt: timestamp, updatedAt: timestamp });
  await audit({ actorId: id, action: "register", resource: "user", resourceId: id, ip, metadata: {} });
  return { verificationPath: `/verify-email?token=${encodeURIComponent(token)}` };
}

export async function login(input: { email: string; password: string }, ip: string): Promise<SessionUser> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabasePublic().auth.signInWithPassword(input);
    if (error || !data.user) {
      await bcrypt.compare(input.password, DUMMY_HASH);
      await audit({ actorId: null, action: "failed_login", resource: "session", resourceId: null, ip, metadata: {} });
      throw new AuthError("INVALID_CREDENTIALS", "Email atau kata sandi tidak valid.", 401);
    }
    if (!data.user.email_confirmed_at) throw new AuthError("EMAIL_UNVERIFIED", "Verifikasi email diperlukan sebelum masuk.", 403);
    const user=await loadCurrentUser(data.user.id);
    if(!user)throw new AuthError("INVALID_CREDENTIALS","Email atau kata sandi tidak valid.",401);
    await createSession(user);
    await audit({ actorId: user.id, action: "login", resource: "session", resourceId: null, ip, metadata: {} });
    return user;
  }
  const found = await findLocalUserByEmail(input.email);
  const valid = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !valid) {
    await audit({ actorId: null, action: "failed_login", resource: "session", resourceId: null, ip, metadata: {} });
    throw new AuthError("INVALID_CREDENTIALS", "Email atau kata sandi tidak valid.", 401);
  }
  if (!found.emailVerified) throw new AuthError("EMAIL_UNVERIFIED", "Verifikasi email diperlukan sebelum masuk.", 403);
  const user=await loadCurrentUser(found.id);
  if(!user)throw new AuthError("INVALID_CREDENTIALS","Email atau kata sandi tidak valid.",401);
  await createSession(user);
  await audit({ actorId: user.id, action: "login", resource: "session", resourceId: null, ip, metadata: {} });
  return user;
}

export async function verifyLocalEmail(token: string): Promise<void> {
  if (isSupabaseConfigured()) throw new AuthError("USE_SUPABASE_LINK", "Gunakan tautan verifikasi yang dikirim Supabase.", 400);
  const user = await findLocalUserByToken("verificationTokenHash", hashToken(token));
  if (!user) throw new AuthError("INVALID_TOKEN", "Tautan verifikasi tidak valid atau sudah digunakan.", 400);
  await updateLocalUser(user.id, { emailVerified: true, verificationTokenHash: null });
}

export async function requestPasswordReset(email: string): Promise<{ resetPath: string | null }> {
  if (isSupabaseConfigured()) {
    await getSupabasePublic().auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password` });
    return { resetPath: null };
  }
  const found = await findLocalUserByEmail(email);
  if (!found) { await bcrypt.compare("timing-resistant-placeholder", DUMMY_HASH); return { resetPath: null }; }
  const token = makeToken();
  await updateLocalUser(found.id, { resetTokenHash: hashToken(token), resetExpiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  return { resetPath: `/reset-password?token=${encodeURIComponent(token)}` };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();
    const { data, error: tokenError } = await admin.auth.getUser(token);
    if (tokenError || !data.user) throw new AuthError("INVALID_TOKEN", "Tautan pemulihan tidak valid atau kedaluwarsa.", 400);
    const { error } = await admin.auth.admin.updateUserById(data.user.id, { password });
    if (error) throw new AuthError("RESET_FAILED", "Kata sandi belum dapat diperbarui.", 400);
    return;
  }
  const user = await findLocalUserByToken("resetTokenHash", hashToken(token));
  if (!user || !user.resetExpiresAt || new Date(user.resetExpiresAt).getTime() <= Date.now()) throw new AuthError("INVALID_TOKEN", "Tautan pemulihan tidak valid atau kedaluwarsa.", 400);
  await updateLocalUser(user.id, { passwordHash: await bcrypt.hash(password, 12), resetTokenHash: null, resetExpiresAt: null });
}

export async function updateProfile(user: SessionUser, values: { name: string; whatsapp: string }): Promise<SessionUser> {
  if (!isSupabaseConfigured()) await updateLocalUser(user.id, values);
  else {
    const { error } = await getSupabaseAdmin().from("profiles").update(values).eq("id", user.id);
    if (error) throw error;
  }
  const updated = { ...user, name: values.name };
  await createSession(updated);
  return updated;
}

export async function changePassword(user: SessionUser, currentPassword: string, newPassword: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const found = await findLocalUserById(user.id);
    if (!found || !(await bcrypt.compare(currentPassword, found.passwordHash))) throw new AuthError("INVALID_CREDENTIALS", "Kata sandi saat ini tidak valid.", 400);
    await updateLocalUser(user.id, { passwordHash: await bcrypt.hash(newPassword, 12) });
    return;
  }
  const { error: signInError } = await getSupabasePublic().auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) throw new AuthError("INVALID_CREDENTIALS", "Kata sandi saat ini tidak valid.", 400);
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) throw error;
}

export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); this.name = "AuthError"; }
}

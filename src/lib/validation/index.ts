import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/security";

const phone = z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Nomor WhatsApp harus berisi 9–15 digit.");
const tier = z.enum(["low", "medium", "high"]);
const turnstileToken = z.string().max(2048).optional();

export const orderSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  whatsapp: phone,
  email: emailSchema,
  serverName: z.string().trim().min(2, "Nama server minimal 2 karakter.").max(80),
  note: z.string().trim().max(1000).default(""),
  coupon: z.string().trim().max(40).optional().default(""),
  tier,
  packageId: z.string().trim().max(64).nullable().optional(),
  cpu: z.coerce.number().finite(),
  ram: z.coerce.number().finite(),
  storage: z.coerce.number().finite(),
  acceptedPolicy: z.literal(true, { message: "Anda harus menyetujui kebijakan pembelian." }),
  clientPrice: z.number().optional(),
  turnstileToken
}).strict();

export const couponValidationSchema = z.object({
  code: z.string().trim().min(1).max(40),
  tier,
  packageId: z.string().nullable().optional(),
  cpu: z.coerce.number().finite(), ram: z.coerce.number().finite(), storage: z.coerce.number().finite()
}).strict();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  whatsapp: phone,
  password: passwordSchema, turnstileToken
}).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), turnstileToken }).strict();
export const forgotSchema = z.object({ email: emailSchema, turnstileToken }).strict();
export const resetSchema = z.object({ token: z.string().min(20).max(4096), password: passwordSchema }).strict();
export const profileSchema = z.object({ name: z.string().trim().min(2).max(100), whatsapp: phone }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict();
export const ticketSchema = z.object({
  name: z.string().trim().min(2).max(100), email: emailSchema,
  subject: z.string().trim().min(4).max(150), message: z.string().trim().min(10).max(4000), turnstileToken
}).strict();
export const savedConfigurationSchema = z.object({
  name: z.string().trim().min(2).max(80), tier, packageId: z.string().nullable().optional(),
  cpu: z.coerce.number().finite(), ram: z.coerce.number().finite(), storage: z.coerce.number().finite()
}).strict();

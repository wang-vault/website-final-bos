import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AuditRecord,
  ContentRecord,
  CouponRecord,
  NotificationRecord,
  OrderRecord,
  Product,
  ServiceRecord,
  ServiceRenewalRecord,
  TicketRecord,
  VpsLocation,
  VpsPackage
} from "@/types";

export interface LocalUserRecord {
  id: string;
  email: string;
  name: string;
  whatsapp: string;
  passwordHash: string;
  role: "owner" | "admin" | "staff" | "customer";
  emailVerified: boolean;
  verificationTokenHash: string | null;
  resetTokenHash: string | null;
  resetExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedConfigurationRecord {
  id: string;
  customerId: string;
  name: string;
  tier: "low" | "medium" | "high";
  packageId: string | null;
  cpu: number;
  ram: number;
  storage: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceReminderRecord {
  id: string;
  serviceId: string;
  customerId: string;
  reminderType: string;
  expiresAt: string;
  scheduledAt: string;
  sentAt: string | null;
  status: "scheduled" | "sent" | "failed" | "skipped";
  createdAt: string;
}

export interface SettingRecord { key: string; value: string; updatedAt: string }
export interface GenericCmsRecord { id: string; resource: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }
export interface LocalState {
  users: LocalUserRecord[];
  products: Product[];
  orders: OrderRecord[];
  coupons: CouponRecord[];
  couponUsages: Array<{ id: string; couponId: string; orderId: string; customerKey: string; createdAt: string }>;
  savedConfigurations: SavedConfigurationRecord[];
  tickets: TicketRecord[];
  notifications: NotificationRecord[];
  blogPosts: ContentRecord[];
  knowledgeArticles: ContentRecord[];
  services: ServiceRecord[];
  serviceRenewals: ServiceRenewalRecord[];
  serviceReminders: ServiceReminderRecord[];
  vpsPackages: VpsPackage[];
  vpsLocations: VpsLocation[];
  audits: AuditRecord[];
  settings: SettingRecord[];
  cmsRecords: GenericCmsRecord[];
}

const DATA_DIR = process.env.WANGSTORE_LOCAL_DATA_DIR ? path.resolve(process.env.WANGSTORE_LOCAL_DATA_DIR) : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "wangstore.local.json");
let queue: Promise<void> = Promise.resolve();

const now = "2026-08-17T00:00:00.000Z";
function initialState(): LocalState {
  return {
    users: [],
    products: [
      {
        id: "prod-minecraft-low",
        name: "Minecraft Hosting Low",
        slug: "minecraft-low",
        description: "Konfigurasi fleksibel untuk memulai server Minecraft sesuai kebutuhan CPU, RAM, dan penyimpanan.",
        tier: "low",
        serviceType: "minecraft",
        status: "available",
        visibility: true,
        renewable: true,
        metadata: { configuration: "custom" }
      },
      {
        id: "prod-minecraft-high",
        name: "Minecraft Hosting High",
        slug: "minecraft-high",
        description: "Paket tetap dengan prosesor berperforma tinggi untuk beban kerja Minecraft yang lebih intensif.",
        tier: "high",
        serviceType: "minecraft",
        status: "available",
        visibility: true,
        renewable: true,
        metadata: { configuration: "package" }
      },
      {
        id: "prod-minecraft-medium",
        name: "Minecraft Hosting Medium",
        slug: "minecraft-medium",
        description: "Pilihan paket yang sedang dipersiapkan dan belum tersedia untuk pemesanan.",
        tier: "medium",
        serviceType: "minecraft",
        status: "ongoing",
        visibility: true,
        renewable: true,
        metadata: { configuration: "package" }
      }
    ],
    orders: [], coupons: [], couponUsages: [], savedConfigurations: [], tickets: [], notifications: [],
    blogPosts: [], knowledgeArticles: [], services: [], serviceRenewals: [], serviceReminders: [],
    vpsPackages: [], vpsLocations: [], audits: [], cmsRecords: [],
    settings: [
      { key: "whatsapp_number", value: process.env.WHATSAPP_NUMBER ?? "", updatedAt: now },
      { key: "contact_email", value: "", updatedAt: now },
      { key: "discord_url", value: process.env.NEXT_PUBLIC_DISCORD_URL ?? "", updatedAt: now },
      { key: "maintenance_enabled", value: "false", updatedAt: now },
      { key: "maintenance_title", value: "Pemeliharaan Terjadwal", updatedAt: now },
      { key: "maintenance_message", value: "Platform sedang menjalani pemeliharaan. Silakan kembali beberapa saat lagi.", updatedAt: now },
      { key: "maintenance_restoration", value: "", updatedAt: now },
      { key: "maintenance_allowed_paths", value: "/status,/login,/api/auth", updatedAt: now }
    ]
  };
}

async function ensureFile(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Supabase wajib dikonfigurasi untuk penyimpanan lingkungan produksi.");
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await atomicWrite(initialState());
  }
}

async function atomicWrite(state: LocalState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const temporaryFile = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryFile, DATA_FILE);
  } finally {
    await fs.rm(temporaryFile, { force: true });
  }
}

export async function readLocalState(): Promise<LocalState> {
  await ensureFile();
  const content = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(content) as LocalState;
}

export function updateLocalState<T>(mutator: (state: LocalState) => T | Promise<T>): Promise<T> {
  let result: T;
  const task = queue.then(async () => {
    const state = await readLocalState();
    result = await mutator(state);
    await atomicWrite(state);
  });
  queue = task.catch(() => undefined);
  return task.then(() => result);
}

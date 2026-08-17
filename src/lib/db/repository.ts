import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  AuditRecord,
  CatalogPackage,
  ContentRecord,
  CouponRecord,
  NotificationRecord,
  OrderRecord,
  Product,
  ServiceRecord,
  ServiceRenewalRecord,
  SessionUser,
  TicketRecord,
  VpsLocation,
  VpsPackage
} from "@/types";
import { readLocalState, updateLocalState, type LocalUserRecord, type SavedConfigurationRecord, type ServiceReminderRecord } from "./local";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";
import type { Configuration } from "@/lib/pricing";

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function tokenMatchesHash(value:string,expectedHash:string):boolean{const actual=Buffer.from(hashToken(value),"hex");const expected=Buffer.from(expectedHash,"hex");return actual.length===expected.length&&timingSafeEqual(actual,expected)}
export function makeToken(): string { return randomBytes(32).toString("base64url"); }
function now(): string { return new Date().toISOString(); }
function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

export async function listProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).products.filter((item) => item.visibility);
  const { data, error } = await getSupabaseAdmin().from("products").select("*").eq("visibility", true).neq("status", "inactive").order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id), name: String(row.name), slug: String(row.slug), description: String(row.description),
    tier: row.tier as Product["tier"], serviceType: row.service_type as Product["serviceType"], status: row.status as Product["status"],
    visibility: Boolean(row.visibility), renewable: Boolean(row.renewable), metadata: (row.metadata ?? {}) as Product["metadata"]
  }));
}

export async function listMediumPackages(includeUnavailable = false): Promise<CatalogPackage[]> {
  if (!isSupabaseConfigured()) {
    const state = await readLocalState();
    if (!includeUnavailable && !state.products.some((item) => item.tier === "medium" && item.status === "available" && item.visibility)) return [];
    return state.cmsRecords.filter((item) => item.resource === "packages").map((item) => ({ id: item.id, tier: "medium" as const, name: String(item.data.name), cpu: Number(item.data.cpu), ram: Number(item.data.ram), storage: Number(item.data.storage), price: Number(item.data.price), status: item.data.status as CatalogPackage["status"], popular: Boolean(item.data.popular) })).filter((item) => includeUnavailable || item.status === "available");
  }
  let query = getSupabaseAdmin().from("packages").select("id,name,cpu,ram,storage,price,status,popular,products!inner(tier,status,visibility,deleted_at)").eq("products.tier", "medium");
  if (!includeUnavailable) query = query.eq("status", "available").eq("products.status", "available").eq("products.visibility", true).is("products.deleted_at", null);
  const { data, error } = await query.order("price");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), tier: "medium", name: String(row.name), cpu: Number(row.cpu), ram: Number(row.ram), storage: Number(row.storage), price: Number(row.price), status: row.status as CatalogPackage["status"], popular: Boolean(row.popular) }));
}

export async function getProductByTier(tier: string): Promise<Product | null> {
  return (await listProducts()).find((item) => item.tier === tier) ?? null;
}

export async function getSetting(key: string): Promise<string> {
  if (!isSupabaseConfigured()) return (await readLocalState()).settings.find((item) => item.key === key)?.value ?? "";
  const { data } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", key).maybeSingle();
  return data ? String(data.value ?? "") : "";
}

export async function updateSettings(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  if (!isSupabaseConfigured()) {
    await updateLocalState((state) => {
      for (const [key, value] of entries) {
        const found = state.settings.find((item) => item.key === key);
        if (found) { found.value = value; found.updatedAt = now(); }
        else state.settings.push({ key, value, updatedAt: now() });
      }
    });
    return;
  }
  const { error } = await getSupabaseAdmin().from("app_settings").upsert(entries.map(([key, value]) => ({ key, value, updated_at: now() })));
  if (error) throw error;
}

export interface CreateOrderInput {
  customerId: string;
  name: string; whatsapp: string; email: string; serverName: string; note: string;
  configuration: Configuration; subtotal: number; couponCode: string | null;
  ip: string;
}
export interface CreatedOrder { order: OrderRecord; accessToken: string }

function validateCoupon(coupon: CouponRecord, subtotal: number, tier: string, customerKey: string, usageForCustomer: number): number {
  if (!coupon.active) throw new RepositoryError("COUPON_INACTIVE", "Kupon tidak aktif.");
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now()) throw new RepositoryError("COUPON_EXPIRED", "Masa berlaku kupon telah berakhir.");
  if (coupon.maximumUsage !== null && coupon.usageCount >= coupon.maximumUsage) throw new RepositoryError("COUPON_LIMIT", "Batas penggunaan kupon telah tercapai.");
  if (usageForCustomer >= coupon.usagePerCustomer) throw new RepositoryError("COUPON_CUSTOMER_LIMIT", "Kupon telah mencapai batas penggunaan untuk pelanggan ini.");
  if (subtotal < coupon.minimumOrder) throw new RepositoryError("COUPON_MINIMUM", "Nilai pesanan belum memenuhi minimum kupon.");
  if (coupon.applicableTier && coupon.applicableTier !== tier) throw new RepositoryError("COUPON_TIER", "Kupon tidak berlaku untuk tier ini.");
  const raw = coupon.discountType === "percentage" ? subtotal * coupon.discountValue / 100 : coupon.discountValue;
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const accessToken = makeToken();
  const id = `WS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  if (!input.customerId.trim()) throw new RepositoryError("ORDER_OWNER_REQUIRED", "Pesanan harus terhubung ke akun pelanggan.");
  const customerKey = input.customerId;
  if (!isSupabaseConfigured()) {
    const order = await updateLocalState((state) => {
      let discount = 0;
      let coupon: CouponRecord | undefined;
      if (input.couponCode) {
        coupon = state.coupons.find((item) => item.code === input.couponCode?.toUpperCase());
        if (!coupon) throw new RepositoryError("COUPON_NOT_FOUND", "Kupon tidak ditemukan.");
        const uses = state.couponUsages.filter((item) => item.couponId === coupon?.id && item.customerKey === customerKey).length;
        discount = validateCoupon(coupon, input.subtotal, input.configuration.tier, customerKey, uses);
      }
      const created: OrderRecord = {
        id, customerId: input.customerId, name: input.name, whatsapp: input.whatsapp, email: input.email,
        serverName: input.serverName, note: input.note, tier: input.configuration.tier,
        packageId: input.configuration.packageId ?? null, cpu: input.configuration.cpu, ram: input.configuration.ram,
        storage: input.configuration.storage, subtotal: input.subtotal, discount, total: Math.max(1, input.subtotal - discount),
        couponCode: coupon?.code ?? null, status: "pending", paymentReference: null, accessTokenHash: hashToken(accessToken), createdAt: now(), updatedAt: now()
      };
      state.orders.push(created);
      if (coupon) {
        coupon.usageCount += 1;
        coupon.updatedAt = now();
        state.couponUsages.push({ id: randomUUID(), couponId: coupon.id, orderId: id, customerKey, createdAt: now() });
      }
      state.audits.push({ id: randomUUID(), actorId: input.customerId, action: "create", resource: "order", resourceId: id, ip: input.ip, metadata: { tier: input.configuration.tier, total: created.total }, createdAt: now() });
      return created;
    });
    return { order, accessToken };
  }
  const { data, error } = await getSupabaseAdmin().rpc("create_order_transaction", {
    p_order_id: id, p_customer_id: input.customerId, p_name: input.name, p_whatsapp: input.whatsapp,
    p_email: input.email, p_server_name: input.serverName, p_note: input.note,
    p_tier: input.configuration.tier, p_package_id: input.configuration.packageId ?? null,
    p_cpu: input.configuration.cpu, p_ram: input.configuration.ram, p_storage: input.configuration.storage,
    p_subtotal: input.subtotal, p_coupon_code: input.couponCode, p_access_token_hash: hashToken(accessToken), p_ip: input.ip
  });
  if (error) throw new RepositoryError("ORDER_TRANSACTION", error.message);
  const row = must((data as Record<string, unknown>[] | null)?.[0], "Pesanan tidak dihasilkan oleh transaksi.");
  return { order: mapOrder(row), accessToken };
}

function mapOrder(row: Record<string, unknown>): OrderRecord {
  return {
    id: String(row.id), customerId: row.customer_id ? String(row.customer_id) : null, name: String(row.name),
    whatsapp: String(row.whatsapp), email: String(row.email), serverName: String(row.server_name), note: String(row.note ?? ""),
    tier: row.tier as OrderRecord["tier"], packageId: row.package_id ? String(row.package_id) : null,
    cpu: Number(row.cpu), ram: Number(row.ram), storage: Number(row.storage), subtotal: Number(row.subtotal),
    discount: Number(row.discount), total: Number(row.total), couponCode: row.coupon_code ? String(row.coupon_code) : null,
    status: row.status as OrderRecord["status"], paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    accessTokenHash: String(row.access_token_hash), createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  if (!isSupabaseConfigured()) return (await readLocalState()).orders.find((item) => item.id === id) ?? null;
  const { data, error } = await getSupabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as Record<string, unknown>) : null;
}

export async function listOrdersForUser(user: SessionUser): Promise<OrderRecord[]> {
  if (!isSupabaseConfigured()) {
    const orders = (await readLocalState()).orders;
    return (user.role === "customer" ? orders.filter((item) => item.customerId === user.id) : orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let query = getSupabaseAdmin().from("orders").select("*").order("created_at", { ascending: false });
  if (user.role === "customer") query = query.eq("customer_id", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
}

const orderTransitions: Readonly<Record<OrderRecord["status"], readonly OrderRecord["status"][]>> = {
  pending: ["awaiting_payment", "paid", "cancelled", "expired"],
  awaiting_payment: ["pending", "paid", "cancelled", "expired"],
  paid: ["processing", "completed", "refunded"],
  processing: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  expired: [],
  refunded: []
};

export async function transitionOrderStatus(input: {
  orderId: string;
  status: OrderRecord["status"];
  paymentReference: string | null;
  reason: string;
  actorId: string;
  ip: string;
  at?: Date;
}): Promise<{ order: OrderRecord; service: ServiceRecord | null }> {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new RepositoryError("ORDER_REASON_REQUIRED", "Alasan perubahan wajib diisi.", 422);
  if (!isSupabaseConfigured()) {
    return updateLocalState((state) => {
      const order = state.orders.find((item) => item.id === input.orderId);
      if (!order) throw new RepositoryError("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
      const existingService = state.services.find((item) => item.orderId === order.id) ?? null;
      if (order.status === input.status) return { order, service: existingService };
      if (!orderTransitions[order.status].includes(input.status)) {
        throw new RepositoryError("ORDER_TRANSITION", `Status pesanan tidak dapat diubah dari ${order.status} menjadi ${input.status}.`, 409);
      }

      const changedAt = (input.at ?? new Date()).toISOString();
      let service = existingService;
      if (input.status === "paid") {
        const reference = input.paymentReference?.trim() ?? "";
        if (reference.length < 3) throw new RepositoryError("PAYMENT_REFERENCE_REQUIRED", "Referensi pembayaran wajib diisi untuk mengonfirmasi pembayaran.", 422);
        if (!order.customerId || !state.users.some((user) => user.id === order.customerId)) {
          throw new RepositoryError("ORDER_CUSTOMER_REQUIRED", "Pesanan harus terhubung ke akun pelanggan sebelum pembayaran dikonfirmasi.", 409);
        }
        if (!service) {
          const product = state.products.find((item) => item.tier === order.tier);
          if (!product) throw new RepositoryError("ORDER_PRODUCT_NOT_FOUND", "Produk pesanan tidak ditemukan.", 409);
          service = {
            id: randomUUID(), customerId: order.customerId, orderId: order.id, productId: product.id,
            packageId: order.packageId, serviceType: product.serviceType, status: "active", activationAt: changedAt,
            expiresAt: new Date(new Date(changedAt).getTime() + 30 * 86_400_000).toISOString(),
            renewable: product.renewable, price: order.subtotal, createdAt: changedAt, updatedAt: changedAt
          };
          state.services.push(service);
          state.notifications.push({
            id: randomUUID(), customerId: order.customerId, serviceId: service.id, title: "Layanan berhasil dibuat",
            message: `Pembayaran pesanan ${order.id} telah dikonfirmasi. Layanan ${service.id} aktif hingga ${service.expiresAt}.`,
            readAt: null, createdAt: changedAt
          });
        }
        order.paymentReference = reference;
      } else if (["processing", "completed"].includes(input.status) && !service) {
        throw new RepositoryError("ORDER_SERVICE_REQUIRED", "Pesanan terbayar belum memiliki layanan. Pulihkan layanan sebelum melanjutkan status.", 409);
      }

      const previousStatus = order.status;
      order.status = input.status;
      order.updatedAt = changedAt;
      state.audits.push({
        id: randomUUID(), actorId: input.actorId, action: input.status === "paid" ? "confirm_payment" : "transition",
        resource: "order", resourceId: order.id, ip: input.ip,
        metadata: { previousStatus, status: input.status, reason, paymentReference: order.paymentReference, serviceId: service?.id ?? null },
        createdAt: changedAt
      });
      return { order, service };
    });
  }

  const { data, error } = await getSupabaseAdmin().rpc("transition_order_status", {
    p_order_id: input.orderId,
    p_status: input.status,
    p_payment_reference: input.paymentReference,
    p_reason: reason,
    p_actor_id: input.actorId,
    p_ip: input.ip
  });
  if (error) throw new RepositoryError("ORDER_TRANSITION", error.message, 409);
  const result = data as { orderId?: unknown; serviceId?: unknown } | null;
  if (!result?.orderId) throw new RepositoryError("ORDER_TRANSITION", "Transaksi status pesanan tidak menghasilkan data.");
  const order = must(await getOrder(String(result.orderId)), "Pesanan tidak ditemukan setelah transaksi status.");
  const service = result.serviceId ? await getService(String(result.serviceId)) : null;
  return { order, service };
}

export async function validateCouponCode(code: string, subtotal: number, tier: string, customerKey: string): Promise<{ code: string; discount: number }> {
  if (!isSupabaseConfigured()) {
    const state = await readLocalState();
    const coupon = state.coupons.find((item) => item.code === code.toUpperCase());
    if (!coupon) throw new RepositoryError("COUPON_NOT_FOUND", "Kupon tidak ditemukan.");
    const uses = state.couponUsages.filter((item) => item.couponId === coupon.id && item.customerKey === customerKey).length;
    return { code: coupon.code, discount: validateCoupon(coupon, subtotal, tier, customerKey, uses) };
  }
  const { data, error } = await getSupabaseAdmin().rpc("validate_coupon", { p_code: code, p_subtotal: subtotal, p_tier: tier, p_customer_key: customerKey });
  if (error) throw new RepositoryError("COUPON_INVALID", error.message);
  const result = must((data as Array<{ code: string; discount: number }> | null)?.[0], "Kupon tidak valid.");
  return result;
}

export async function findLocalUserByEmail(email: string): Promise<LocalUserRecord | null> {
  if (isSupabaseConfigured()) return null;
  return (await readLocalState()).users.find((item) => item.email === email.toLowerCase()) ?? null;
}
export async function findLocalUserById(id: string): Promise<LocalUserRecord | null> {
  if (isSupabaseConfigured()) return null;
  return (await readLocalState()).users.find((item) => item.id === id) ?? null;
}
export async function createLocalUser(user: LocalUserRecord): Promise<void> {
  await updateLocalState((state) => {
    if (state.users.some((item) => item.email === user.email)) throw new RepositoryError("EMAIL_USED", "Pendaftaran tidak dapat diproses.");
    state.users.push(user);
  });
}
export async function updateLocalUser(id: string, changes: Partial<Pick<LocalUserRecord, "name" | "whatsapp" | "passwordHash" | "emailVerified" | "verificationTokenHash" | "resetTokenHash" | "resetExpiresAt">>): Promise<void> {
  await updateLocalState((state) => Object.assign(must(state.users.find((item) => item.id === id), "Pengguna tidak ditemukan."), changes, { updatedAt: now() }));
}
export async function findLocalUserByToken(field: "verificationTokenHash" | "resetTokenHash", hash: string): Promise<LocalUserRecord | null> {
  return (await readLocalState()).users.find((item) => item[field] === hash) ?? null;
}

export async function audit(input: Omit<AuditRecord, "id" | "createdAt">): Promise<void> {
  const record = { ...input, id: randomUUID(), createdAt: now() };
  if (!isSupabaseConfigured()) { await updateLocalState((state) => { state.audits.push(record); }); return; }
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({ id: record.id, actor_id: record.actorId, action: record.action, resource: record.resource, resource_id: record.resourceId, ip: record.ip, metadata: record.metadata, created_at: record.createdAt });
  if (error) throw error;
}

export async function listAudits(): Promise<AuditRecord[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).audits.toReversed().slice(0, 200);
  const { data, error } = await getSupabaseAdmin().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), actorId: row.actor_id ? String(row.actor_id) : null, action: String(row.action), resource: String(row.resource), resourceId: row.resource_id ? String(row.resource_id) : null, ip: String(row.ip ?? ""), metadata: (row.metadata ?? {}) as AuditRecord["metadata"], createdAt: String(row.created_at) }));
}

export async function createTicket(input: Omit<TicketRecord, "id" | "status" | "priority" | "createdAt" | "updatedAt">): Promise<TicketRecord> {
  const record: TicketRecord = { ...input, id: `TKT-${randomBytes(4).toString("hex").toUpperCase()}`, status: "open", priority: "normal", createdAt: now(), updatedAt: now() };
  if (!isSupabaseConfigured()) { await updateLocalState((state) => { state.tickets.push(record); }); return record; }
  const { error } = await getSupabaseAdmin().from("tickets").insert({ id: record.id, customer_id: record.customerId, name: record.name, email: record.email, subject: record.subject, message: record.message, status: record.status, priority: record.priority });
  if (error) throw error;
  return record;
}

export async function listTickets(user: SessionUser): Promise<TicketRecord[]> {
  if (!isSupabaseConfigured()) { const rows = (await readLocalState()).tickets; return user.role === "customer" ? rows.filter((item) => item.customerId === user.id) : rows; }
  let query = getSupabaseAdmin().from("tickets").select("*").order("created_at", { ascending: false });
  if (user.role === "customer") query = query.eq("customer_id", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), customerId: row.customer_id ? String(row.customer_id) : null, name: String(row.name), email: String(row.email), subject: String(row.subject), message: String(row.message), status: row.status as TicketRecord["status"], priority: row.priority as TicketRecord["priority"], createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}

export async function listContent(kind: "blog" | "knowledge", includeDraft = false): Promise<ContentRecord[]> {
  if (!isSupabaseConfigured()) {
    const rows = kind === "blog" ? (await readLocalState()).blogPosts : (await readLocalState()).knowledgeArticles;
    return rows.filter((item) => includeDraft || item.status === "published").sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
  }
  const table = kind === "blog" ? "blog_posts" : "knowledge_articles";
  let query = getSupabaseAdmin().from(table).select("*").order("published_at", { ascending: false });
  if (!includeDraft) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapContent);
}
function mapContent(row: Record<string, unknown>): ContentRecord {
  return { id: String(row.id), slug: String(row.slug), title: String(row.title), excerpt: String(row.excerpt), content: String(row.content), category: String(row.category), tags: Array.isArray(row.tags) ? row.tags.map(String) : [], author: String(row.author), status: row.status as ContentRecord["status"], publishedAt: row.published_at ? String(row.published_at) : null, updatedAt: String(row.updated_at), seoTitle: String(row.seo_title ?? row.title), seoDescription: String(row.seo_description ?? row.excerpt) };
}
export async function getContent(kind: "blog" | "knowledge", slug: string): Promise<ContentRecord | null> {
  return (await listContent(kind)).find((item) => item.slug === slug) ?? null;
}

export async function saveConfiguration(userId: string, config: Configuration, name: string): Promise<SavedConfigurationRecord> {
  const record: SavedConfigurationRecord = { id: randomUUID(), customerId: userId, name, tier: config.tier, packageId: config.packageId ?? null, cpu: config.cpu, ram: config.ram, storage: config.storage, createdAt: now(), updatedAt: now() };
  if (!isSupabaseConfigured()) { await updateLocalState((state) => { state.savedConfigurations.push(record); }); return record; }
  const { error } = await getSupabaseAdmin().from("saved_configurations").insert({ id: record.id, customer_id: userId, name, tier: record.tier, package_id: record.packageId, cpu: record.cpu, ram: record.ram, storage: record.storage });
  if (error) throw error;
  return record;
}
export async function listSavedConfigurations(userId: string): Promise<SavedConfigurationRecord[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).savedConfigurations.filter((item) => item.customerId === userId);
  const { data, error } = await getSupabaseAdmin().from("saved_configurations").select("*").eq("customer_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), customerId: String(row.customer_id), name: String(row.name), tier: row.tier as SavedConfigurationRecord["tier"], packageId: row.package_id ? String(row.package_id) : null, cpu: Number(row.cpu), ram: Number(row.ram), storage: Number(row.storage), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}

export async function listServices(user: SessionUser): Promise<ServiceRecord[]> {
  if (!isSupabaseConfigured()) { const rows = (await readLocalState()).services; return user.role === "customer" ? rows.filter((item) => item.customerId === user.id) : rows; }
  let query = getSupabaseAdmin().from("service_instances").select("*").order("created_at", { ascending: false });
  if (user.role === "customer") query = query.eq("customer_id", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), customerId: String(row.customer_id), orderId: String(row.order_id), productId: String(row.product_id), packageId: row.package_id ? String(row.package_id) : null, serviceType: String(row.service_type), status: row.status as ServiceRecord["status"], activationAt: String(row.activation_at), expiresAt: String(row.expires_at), renewable: Boolean(row.renewable), price: Number(row.price), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}
export async function getService(id: string): Promise<ServiceRecord | null> {
  if (!isSupabaseConfigured()) return (await readLocalState()).services.find((item) => item.id === id) ?? null;
  const user = { id: "", role: "owner", email: "", name: "", emailVerified: true } satisfies SessionUser;
  return (await listServices(user)).find((item) => item.id === id) ?? null;
}

export async function createRenewal(input: { service: ServiceRecord; customerId: string; duration: number; oldExpiresAt: string; newExpiresAt: string; price: number; ip: string }): Promise<ServiceRenewalRecord> {
  const orderId = `RNW-${randomBytes(5).toString("hex").toUpperCase()}`;
  const record: ServiceRenewalRecord = { id: randomUUID(), serviceId: input.service.id, orderId, duration: input.duration, oldExpiresAt: input.oldExpiresAt, newExpiresAt: input.newExpiresAt, price: input.price, status: "pending", paymentReference: null, createdAt: now(), completedAt: null };
  if (!isSupabaseConfigured()) {
    await updateLocalState((state) => {
      if (state.serviceRenewals.some((item) => item.serviceId === input.service.id && item.status === "pending")) throw new RepositoryError("RENEWAL_PENDING", "Layanan ini masih memiliki perpanjangan yang menunggu konfirmasi.", 409);
      state.serviceRenewals.push(record);
      state.audits.push({ id: randomUUID(), actorId: input.customerId, action: "create", resource: "service_renewal", resourceId: record.id, ip: input.ip, metadata: { serviceId: input.service.id, duration: input.duration, price: input.price }, createdAt: now() });
    });
    return record;
  }
  const { error } = await getSupabaseAdmin().from("service_renewals").insert({ id: record.id, service_id: record.serviceId, order_id: null, external_order_id: orderId, duration: record.duration, old_expires_at: record.oldExpiresAt, new_expires_at: record.newExpiresAt, price: record.price, status: "pending" });
  if (error) throw new RepositoryError("RENEWAL_CREATE", error.message);
  return record;
}

function mapRenewal(row: Record<string, unknown>): ServiceRenewalRecord {
  return {
    id: String(row.id), serviceId: String(row.service_id), orderId: String(row.external_order_id ?? row.order_id ?? ""),
    duration: Number(row.duration), oldExpiresAt: String(row.old_expires_at), newExpiresAt: String(row.new_expires_at),
    price: Number(row.price), status: row.status as ServiceRenewalRecord["status"],
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null
  };
}

export async function listServiceRenewals(user: SessionUser): Promise<ServiceRenewalRecord[]> {
  if (!isSupabaseConfigured()) {
    const state = await readLocalState();
    const permittedServices = user.role === "customer" ? new Set(state.services.filter((item) => item.customerId === user.id).map((item) => item.id)) : null;
    return state.serviceRenewals.filter((item) => !permittedServices || permittedServices.has(item.serviceId)).map((item) => ({ ...item, paymentReference: item.paymentReference ?? null })).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let query = getSupabaseAdmin().from("service_renewals").select("*,service_instances!inner(customer_id)").order("created_at", { ascending: false });
  if (user.role === "customer") query = query.eq("service_instances.customer_id", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRenewal(row as Record<string, unknown>));
}

export async function completeServiceRenewal(input: { renewalId: string; actorId: string; ip: string; paymentReference: string; reason: string; at?: Date }): Promise<ServiceRenewalRecord> {
  if (!isSupabaseConfigured()) {
    return updateLocalState((state) => {
      const renewal = must(state.serviceRenewals.find((item) => item.id === input.renewalId), "Perpanjangan tidak ditemukan.");
      if (renewal.status === "cancelled") throw new RepositoryError("RENEWAL_CANCELLED", "Perpanjangan yang dibatalkan tidak dapat dikonfirmasi.", 409);
      if (renewal.status === "completed") return renewal;
      const service = must(state.services.find((item) => item.id === renewal.serviceId), "Layanan untuk perpanjangan tidak ditemukan.");
      if (["cancelled", "terminated"].includes(service.status)) throw new RepositoryError("INVALID_STATUS", "Status layanan tidak dapat diperpanjang.", 409);
      const completedAt = (input.at ?? new Date()).toISOString();
      const completionTime = new Date(completedAt).getTime();
      const currentExpiration = new Date(service.expiresAt).getTime();
      const newExpiration = new Date(Math.max(currentExpiration, completionTime) + renewal.duration * 86_400_000).toISOString();
      if (currentExpiration <= completionTime) service.activationAt = completedAt;
      service.expiresAt = newExpiration;
      if (service.status !== "suspended") service.status = "active";
      service.updatedAt = completedAt;
      renewal.newExpiresAt = newExpiration;
      renewal.status = "completed";
      renewal.paymentReference = input.paymentReference;
      renewal.completedAt = completedAt;
      state.audits.push({ id: randomUUID(), actorId: input.actorId, action: "confirm", resource: "service_renewal", resourceId: renewal.id, ip: input.ip, metadata: { serviceId: service.id, paymentReference: input.paymentReference, reason: input.reason, newExpiresAt: newExpiration }, createdAt: completedAt });
      return renewal;
    });
  }
  const { data, error } = await getSupabaseAdmin().rpc("complete_service_renewal", { p_renewal_id: input.renewalId, p_actor_id: input.actorId, p_ip: input.ip, p_payment_reference: input.paymentReference, p_reason: input.reason });
  if (error) throw new RepositoryError("RENEWAL_CONFIRM", error.message);
  return mapRenewal(must((data as Record<string, unknown>[] | null)?.[0], "Perpanjangan tidak dihasilkan oleh transaksi konfirmasi."));
}

export async function listNotifications(userId: string): Promise<NotificationRecord[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).notifications.filter((item) => item.customerId === userId).toReversed();
  const { data, error } = await getSupabaseAdmin().from("notifications").select("*").eq("customer_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), customerId: String(row.customer_id), serviceId: row.service_id ? String(row.service_id) : null, title: String(row.title), message: String(row.message), readAt: row.read_at ? String(row.read_at) : null, createdAt: String(row.created_at) }));
}

export async function runServiceReminders(at = new Date()): Promise<{ created: number }> {
  const intervals = [{ days: 7, type: "expires_7_days" }, { days: 3, type: "expires_3_days" }, { days: 1, type: "expires_1_day" }, { days: 0, type: "expired" }];
  if (!isSupabaseConfigured()) {
    return updateLocalState((state) => {
      let created = 0;
      for (const service of state.services) {
        if (["cancelled", "terminated"].includes(service.status)) continue;
        const expiration = new Date(service.expiresAt).getTime();
        const activation = new Date(service.activationAt).getTime();
        if (expiration <= at.getTime() && service.status !== "expired") { service.status = "expired"; service.updatedAt = at.toISOString(); }
        else if (activation <= at.getTime() && expiration > at.getTime() && service.status === "scheduled") { service.status = "active"; service.updatedAt = at.toISOString(); }
        const remaining = Math.ceil((expiration - at.getTime()) / 86_400_000);
        const interval = intervals.find((item) => item.days === Math.max(0, remaining));
        if (!interval) continue;
        const exists = state.serviceReminders.some((item) => item.serviceId === service.id && item.reminderType === interval.type && item.expiresAt === service.expiresAt);
        if (exists) continue;
        const reminder: ServiceReminderRecord = { id: randomUUID(), serviceId: service.id, customerId: service.customerId, reminderType: interval.type, expiresAt: service.expiresAt, scheduledAt: at.toISOString(), sentAt: at.toISOString(), status: "sent", createdAt: now() };
        state.serviceReminders.push(reminder);
        state.notifications.push({ id: randomUUID(), customerId: service.customerId, serviceId: service.id, title: interval.days === 0 ? "Masa layanan berakhir" : "Pengingat masa layanan", message: interval.days === 0 ? `Layanan ${service.id} telah berakhir.` : `Layanan ${service.id} akan berakhir dalam ${interval.days} hari.`, readAt: null, createdAt: now() });
        created += 1;
      }
      return { created };
    });
  }
  const { data, error } = await getSupabaseAdmin().rpc("process_service_reminders", { p_now: at.toISOString() });
  if (error) throw error;
  return { created: Number(data ?? 0) };
}

export async function listVpsPackages(includeHidden = false): Promise<VpsPackage[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).vpsPackages.filter((item) => includeHidden || item.visibility);
  let query = getSupabaseAdmin().from("vps_packages").select("*").order("price");
  if (!includeHidden) query = query.eq("visibility", true).neq("status", "inactive");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), cpu: Number(row.cpu), ram: Number(row.ram), storage: Number(row.storage), bandwidth: String(row.bandwidth), ipv4Available: Boolean(row.ipv4_available), locationId: String(row.location_id), virtualization: String(row.virtualization), price: Number(row.price), billingPeriod: row.billing_period as VpsPackage["billingPeriod"], durationDays: Number(row.duration_days), renewable: Boolean(row.renewable), status: row.status as VpsPackage["status"], visibility: Boolean(row.visibility), description: String(row.description), features: Array.isArray(row.features) ? row.features.map(String) : [], createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}
export async function listVpsLocations(): Promise<VpsLocation[]> {
  if (!isSupabaseConfigured()) return (await readLocalState()).vpsLocations;
  const { data, error } = await getSupabaseAdmin().from("vps_locations").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), country: String(row.country), city: String(row.city), status: row.status as VpsLocation["status"] }));
}

export interface PublicFaq { id:string;question:string;answer:string;category:string;sortOrder:number }
export interface PublicTestimonial { id:string;customerName:string;quote:string;source:string }
export interface PublicIncident { id:string;title:string;status:string;impact:string;message:string;startedAt:string;resolvedAt:string|null }
export interface PublicAnnouncement { id:string;title:string;message:string;startsAt:string;endsAt:string|null }
export interface PublicPage { id:string;slug:string;title:string;content:string;version:string|null;seoTitle:string;seoDescription:string;updatedAt:string }
function localCmsRows(state:Awaited<ReturnType<typeof readLocalState>>,resource:string):Array<{id:string;data:Record<string,unknown>;updatedAt:string}>{return state.cmsRecords.filter(item=>item.resource===resource)}
export async function getPublicSetting(key:string,fallback=""):Promise<string>{if(!isSupabaseConfigured()&&process.env.NODE_ENV==="production")return fallback;try{return await getSetting(key)||fallback}catch{return fallback}}
export async function listPublicFaq():Promise<PublicFaq[]>{if(!isSupabaseConfigured()){if(process.env.NODE_ENV==="production")return[];return localCmsRows(await readLocalState(),"faq").filter(row=>row.data.published===true).map(row=>({id:row.id,question:String(row.data.question),answer:String(row.data.answer),category:String(row.data.category),sortOrder:Number(row.data.sortOrder)})).sort((a,b)=>a.sortOrder-b.sortOrder)}const{data,error}=await getSupabaseAdmin().from("faq_items").select("id,question,answer,category,sort_order").eq("published",true).order("sort_order");if(error)throw error;return(data??[]).map(row=>({id:String(row.id),question:String(row.question),answer:String(row.answer),category:String(row.category),sortOrder:Number(row.sort_order)}))}
export async function listPublicTestimonials():Promise<PublicTestimonial[]>{if(!isSupabaseConfigured()){if(process.env.NODE_ENV==="production")return[];return localCmsRows(await readLocalState(),"testimonials").filter(row=>row.data.published===true&&row.data.verified===true).map(row=>({id:row.id,customerName:String(row.data.customerName),quote:String(row.data.quote),source:String(row.data.source)}))}const{data,error}=await getSupabaseAdmin().from("testimonials").select("id,customer_name,quote,source").eq("published",true).eq("verified",true).order("created_at",{ascending:false});if(error)throw error;return(data??[]).map(row=>({id:String(row.id),customerName:String(row.customer_name),quote:String(row.quote),source:String(row.source)}))}
export async function listPublicIncidents():Promise<PublicIncident[]>{if(!isSupabaseConfigured()){if(process.env.NODE_ENV==="production")return[];return localCmsRows(await readLocalState(),"incidents").filter(row=>row.data.published===true).map(row=>({id:row.id,title:String(row.data.title),status:String(row.data.status),impact:String(row.data.impact),message:String(row.data.message),startedAt:String(row.data.startedAt),resolvedAt:row.data.resolvedAt?String(row.data.resolvedAt):null})).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))}const{data,error}=await getSupabaseAdmin().from("incidents").select("id,title,status,impact,message,started_at,resolved_at").eq("published",true).order("started_at",{ascending:false}).limit(50);if(error)throw error;return(data??[]).map(row=>({id:String(row.id),title:String(row.title),status:String(row.status),impact:String(row.impact),message:String(row.message),startedAt:String(row.started_at),resolvedAt:row.resolved_at?String(row.resolved_at):null}))}
export async function listPublicAnnouncements():Promise<PublicAnnouncement[]>{const at=new Date().toISOString();if(!isSupabaseConfigured()){if(process.env.NODE_ENV==="production")return[];return localCmsRows(await readLocalState(),"announcements").filter(row=>row.data.active===true&&String(row.data.startsAt)<=at&&(!row.data.endsAt||String(row.data.endsAt)>at)).map(row=>({id:row.id,title:String(row.data.title),message:String(row.data.message),startsAt:String(row.data.startsAt),endsAt:row.data.endsAt?String(row.data.endsAt):null}))}const{data,error}=await getSupabaseAdmin().from("announcements").select("id,title,message,starts_at,ends_at").eq("active",true).lte("starts_at",at).or(`ends_at.is.null,ends_at.gt.${at}`).order("starts_at",{ascending:false}).limit(3);if(error)throw error;return(data??[]).map(row=>({id:String(row.id),title:String(row.title),message:String(row.message),startsAt:String(row.starts_at),endsAt:row.ends_at?String(row.ends_at):null}))}
export async function listPublicPages(kind:"pages"|"legal"):Promise<PublicPage[]>{if(!isSupabaseConfigured()){if(process.env.NODE_ENV==="production")return[];return localCmsRows(await readLocalState(),kind).filter(row=>row.data.status==="published").map(row=>({id:row.id,slug:String(row.data.slug),title:String(row.data.title),content:String(row.data.content),version:row.data.version?String(row.data.version):null,seoTitle:String(row.data.seoTitle??row.data.title),seoDescription:String(row.data.seoDescription??""),updatedAt:row.updatedAt}))}const table=kind==="pages"?"pages":"legal_documents";const{data,error}=await getSupabaseAdmin().from(table).select("*").eq("status","published").order("updated_at",{ascending:false});if(error)throw error;return(data??[]).map(row=>({id:String(row.id),slug:String(row.slug),title:String(row.title),content:String(row.content),version:row.version?String(row.version):null,seoTitle:String(row.seo_title??row.title),seoDescription:String(row.seo_description??""),updatedAt:String(row.updated_at)}))}
export async function getPublicPage(kind:"pages"|"legal",slug:string):Promise<PublicPage|null>{return(await listPublicPages(kind)).find(item=>item.slug===slug)??null}

export class RepositoryError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) { super(message); this.name = "RepositoryError"; }
}

export async function getProfileContact(userId: string): Promise<{ whatsapp: string }> {
  if (!isSupabaseConfigured()) return { whatsapp: (await findLocalUserById(userId))?.whatsapp ?? "" };
  const { data, error } = await getSupabaseAdmin().from("profiles").select("whatsapp").eq("id", userId).maybeSingle();
  if (error) throw error;
  return { whatsapp: data ? String(data.whatsapp ?? "") : "" };
}

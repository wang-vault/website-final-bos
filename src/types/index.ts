export type Role = "owner" | "admin" | "staff" | "customer";
export type Tier = "low" | "medium" | "high";
export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired"
  | "refunded";
export type ServiceStatus =
  | "pending"
  | "scheduled"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled"
  | "terminated";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  tier: Tier | null;
  serviceType: "minecraft" | "vps" | "dedicated" | "panel" | "other";
  status: "available" | "ongoing" | "maintenance" | "inactive";
  visibility: boolean;
  renewable: boolean;
  metadata: Record<string, string | number | boolean | null>;
}

export interface OrderRecord {
  id: string;
  customerId: string | null;
  name: string;
  whatsapp: string;
  email: string;
  serverName: string;
  note: string;
  tier: Tier;
  packageId: string | null;
  cpu: number;
  ram: number;
  storage: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  status: OrderStatus;
  paymentReference: string | null;
  accessTokenHash: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderView = Omit<OrderRecord, "accessTokenHash">;

export interface CouponRecord {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrder: number;
  expiresAt: string | null;
  maximumUsage: number | null;
  usageCount: number;
  usagePerCustomer: number;
  applicableTier: Tier | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: string;
  customerId: string;
  orderId: string;
  productId: string;
  packageId: string | null;
  serviceType: string;
  status: ServiceStatus;
  activationAt: string;
  expiresAt: string;
  renewable: boolean;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRenewalRecord {
  id: string;
  serviceId: string;
  orderId: string;
  duration: number;
  oldExpiresAt: string;
  newExpiresAt: string;
  price: number;
  status: "pending" | "completed" | "cancelled";
  paymentReference: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CatalogPackage {
  id: string;
  tier: Tier;
  name: string;
  cpu: number;
  ram: number;
  storage: number;
  price: number;
  status: "available" | "ongoing" | "maintenance" | "inactive";
  popular: boolean;
}

export interface VpsLocation {
  id: string;
  name: string;
  country: string;
  city: string;
  status: "active" | "maintenance" | "inactive";
}

export interface VpsPackage {
  id: string;
  name: string;
  slug: string;
  cpu: number;
  ram: number;
  storage: number;
  bandwidth: string;
  ipv4Available: boolean;
  locationId: string;
  virtualization: string;
  price: number;
  billingPeriod: "monthly" | "quarterly" | "yearly";
  durationDays: number;
  renewable: boolean;
  status: "available" | "sold_out" | "maintenance" | "inactive";
  visibility: boolean;
  description: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
}

export interface AuditRecord {
  id: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ip: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  customerId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  customerId: string;
  serviceId: string | null;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

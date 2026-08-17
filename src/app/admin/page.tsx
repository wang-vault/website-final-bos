import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { LogoutButton } from "@/components/dashboard-actions";
import { getSessionUser } from "@/lib/auth";
import { adminList } from "@/lib/cms/admin-repository";
import { listServiceRenewals } from "@/lib/db/repository";
import { formatStatus } from "@/lib/utils";
import type { AuditRecord, CatalogPackage, OrderView, Product, ServiceRecord, ServiceRenewalRecord, TicketRecord, VpsLocation, VpsPackage } from "@/types";

export const metadata: Metadata = { title: "Administrasi", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const empty: unknown[] = [];

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "customer") redirect("/dashboard");

  const [orders, tickets, customers] = await Promise.all([
    adminList("orders"), adminList("tickets"), adminList("customers")
  ]);
  const privileged = user.role === "staff" ? null : await Promise.all([
    adminList("products"), adminList("packages"), adminList("services"), listServiceRenewals(user),
    adminList("vpsLocations"), adminList("coupons"), adminList("vps"), adminList("blog"),
    adminList("knowledgeBase"), adminList("faq"), adminList("pages"), adminList("incidents"),
    adminList("announcements"), adminList("settings"), adminList("audit"), adminList("maintenance")
  ]);
  const [products, packages, services, renewals, locations, coupons, vps, blog, knowledge, faq, pages, incidents, announcements, settings, audits, maintenance] = privileged ?? [empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty];
  const ownerOnly = user.role === "owner" ? await Promise.all([
    adminList("testimonials"), adminList("legal")
  ]) : [empty, empty];
  const [testimonials, legal] = ownerOnly;

  return <div className="container-page py-8 sm:py-12">
    <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Panel Administrasi · {formatStatus(user.role)}</p><h1 className="heading-1">Operasional WangStore</h1><p className="mt-2 text-secondary">Data aktual, pengelolaan konten, dan kontrol layanan.</p></div>
      <LogoutButton />
    </header>
    <AdminConsole role={user.role} data={{
      products: products as Product[], packages: packages as CatalogPackage[], orders: orders as OrderView[],
      tickets: tickets as TicketRecord[], audits: audits as AuditRecord[], services: services as ServiceRecord[],
      renewals: renewals as ServiceRenewalRecord[], locations: locations as VpsLocation[], coupons: coupons as Record<string, unknown>[],
      vps: vps as VpsPackage[], blog: blog as Record<string, unknown>[], knowledge: knowledge as Record<string, unknown>[],
      customers: customers as Record<string, unknown>[], faq: faq as Record<string, unknown>[], testimonials: testimonials as Record<string, unknown>[],
      pages: pages as Record<string, unknown>[], legal: legal as Record<string, unknown>[], incidents: incidents as Record<string, unknown>[],
      announcements: announcements as Record<string, unknown>[], settings: settings as Record<string, unknown>[], maintenance: maintenance as Record<string, unknown>[]
    }} />
  </div>;
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ServerBuilder } from "@/components/server-builder";
import { getSessionUser } from "@/lib/auth";
import { getProductByTier, getSetting, listMediumPackages } from "@/lib/db/repository";
export const metadata: Metadata = { title: "Perancang Server", description: "Pilih tier, CPU, RAM, dan penyimpanan; lihat harga serta estimasi secara waktu nyata.", alternates: { canonical: "/server-builder" } };
export const dynamic = "force-dynamic";
export default async function ServerBuilderPage(){const [user,number,mediumProduct,mediumPackages]=await Promise.all([getSessionUser(),getSetting("whatsapp_number"),getProductByTier("medium"),listMediumPackages()]);return <><PageHeader eyebrow="Perancang Server" title="Konfigurasi yang cepat, harga yang jelas." description="Pilih satu tier, atur CPU, RAM, dan penyimpanan, lalu tinjau estimasi sebelum membuat pesanan."/><div className="container-page section-space"><ServerBuilder user={user} whatsappNumber={number || process.env.WHATSAPP_NUMBER || ""} mediumPackages={mediumPackages} mediumAvailable={mediumProduct?.status==="available"&&mediumPackages.length>0}/></div></>}

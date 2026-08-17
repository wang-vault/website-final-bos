import type { Metadata } from "next";
import { ContentList } from "@/components/content-search";
import { PageHeader } from "@/components/page-header";
import { listContent } from "@/lib/db/repository";
export const metadata:Metadata={title:"Pusat Pengetahuan",description:"Dokumentasi bantuan WangStore untuk akun, pesanan, layanan, dan pemecahan masalah.",alternates:{canonical:"/knowledge-base"}};export const dynamic="force-dynamic";
export default async function KnowledgePage({searchParams}:{searchParams:Promise<{q?:string}>}){const query=(await searchParams).q??"";return <><PageHeader eyebrow="Pusat Pengetahuan" title="Temukan jawaban dengan cepat." description="Dokumentasi dikelompokkan dalam Memulai, Pemesanan, Pembayaran, Minecraft, Server, Pemecahan Masalah, Akun, dan Kebijakan."/><div className="container-page section-space"><ContentList items={await listContent("knowledge")} basePath="/knowledge-base" query={query}/></div></>}

import type { Metadata } from "next";
import { ContentList } from "@/components/content-search";
import { PageHeader } from "@/components/page-header";
import { listContent } from "@/lib/db/repository";
export const metadata:Metadata={title:"Blog",description:"Artikel WangStore mengenai hosting, pemesanan, dan pengelolaan layanan.",alternates:{canonical:"/blog"}};export const dynamic="force-dynamic";
export default async function BlogPage({searchParams}:{searchParams:Promise<{q?:string}>}){const query=(await searchParams).q??"";return <><PageHeader eyebrow="Blog" title="Catatan dan panduan dari WangStore." description="Artikel yang telah dipublikasikan mengenai pilihan layanan, operasional, dan praktik pengelolaan server."/><div className="container-page section-space"><ContentList items={await listContent("blog")} basePath="/blog" query={query}/></div></>}

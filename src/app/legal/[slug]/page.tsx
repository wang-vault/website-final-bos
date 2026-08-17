import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Breadcrumb } from "@/components/ui";
import { getPublicPage } from "@/lib/db/repository";
import { formatDate } from "@/lib/utils";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const item=await getPublicPage("legal",(await params).slug);return item?{title:item.seoTitle,description:item.seoDescription,alternates:{canonical:`/legal/${item.slug}`}}:{title:"Dokumen tidak ditemukan"}}
export default async function LegalCmsPage({params}:{params:Promise<{slug:string}>}){const item=await getPublicPage("legal",(await params).slug);if(!item)notFound();return <div className="container-page py-10 sm:py-16"><Breadcrumb items={[{label:"Beranda",href:"/"},{label:"Dokumen Hukum"},{label:item.title}]}/><article className="prose-wang mx-auto mt-10 max-w-3xl"><h1>{item.title}</h1><p>Versi {item.version??"—"} · diperbarui {formatDate(item.updatedAt)}</p><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown></article></div>}

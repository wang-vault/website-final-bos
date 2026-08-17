import type { Metadata } from "next";
import Link from "next/link";
import { Card,EmptyState,linkButton } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { listPublicTestimonials } from "@/lib/db/repository";
export const metadata:Metadata={title:"Testimoni",description:"Testimoni pelanggan WangStore yang telah diverifikasi.",alternates:{canonical:"/testimonials"}};
export const dynamic="force-dynamic";
export default async function TestimonialsPage(){const items=await listPublicTestimonials();return <><PageHeader eyebrow="Testimoni" title="Pengalaman pelanggan harus dapat dipercaya." description="WangStore hanya menampilkan testimoni yang telah diterima, diverifikasi, dan memperoleh persetujuan untuk dipublikasikan."/><div className="container-page section-space">{items.length===0?<EmptyState title="Belum ada testimoni terverifikasi" description="Kami tidak menampilkan ulasan, identitas, atau penilaian fiktif. Bagian ini akan diperbarui setelah ada testimoni yang dapat diverifikasi." action={<Link href="/contact" className={linkButton("secondary")}>Hubungi WangStore</Link>}/>:<div className="grid gap-4 md:grid-cols-2">{items.map(item=><Card key={item.id}><blockquote className="leading-7">“{item.quote}”</blockquote><p className="mt-5 text-sm font-semibold">{item.customerName}</p><p className="mt-1 text-xs text-subtle">Sumber terverifikasi: {item.source}</p></Card>)}</div>}</div></>}

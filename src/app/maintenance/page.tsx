import type { Metadata } from "next";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Card, linkButton } from "@/components/ui";
import { getSetting } from "@/lib/db/repository";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Pemeliharaan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [title, message, restoration] = await Promise.all([
    getSetting("maintenance_title"),
    getSetting("maintenance_message"),
    getSetting("maintenance_restoration")
  ]);
  return <main className="container-page grid min-h-[70vh] place-items-center py-16"><Card className="w-full max-w-2xl text-center"><Clock3 className="mx-auto h-8 w-8"/><p className="eyebrow mt-6">Mode Pemeliharaan</p><h1 className="heading-1 mt-3">{title || "Pemeliharaan Terjadwal"}</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-secondary">{message || "Platform sedang menjalani pemeliharaan. Silakan kembali beberapa saat lagi."}</p>{restoration&&<p className="mt-5 text-sm text-subtle">Perkiraan pemulihan: {formatDate(restoration)}</p>}<div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/status" className={linkButton("primary")}>Lihat Status</Link><Link href="/login" className={linkButton("secondary")}>Masuk sebagai Pengelola</Link></div></Card></main>;
}

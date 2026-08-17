import Link from "next/link";
import { ArrowRight, Check, Layers3, LifeBuoy, Settings2, ShieldCheck } from "lucide-react";
import { Card, Badge, linkButton } from "@/components/ui";
import { TrustPrinciples } from "@/components/logo-strip";
import { listProducts } from "@/lib/db/repository";
import { formatRupiah } from "@/lib/pricing";

export const dynamic = "force-dynamic";
const steps = [
  ["01", "Pilih tier", "Bandingkan karakteristik prosesor dan ketersediaan tiap tier."],
  ["02", "Atur konfigurasi", "Pilih CPU, RAM, dan penyimpanan atau gunakan paket tetap."],
  ["03", "Tinjau pesanan", "Harga dihitung ulang oleh server sebelum pesanan disimpan."],
  ["04", "Lanjut melalui WhatsApp", "Konfirmasi ketersediaan dan instruksi pembayaran melalui kanal yang dikonfigurasi."]
] as const;
const faqs = [
  ["Apakah WangStore menjalankan server pelanggan?", "Tidak. Aplikasi WangStore menangani katalog, pemesanan, akun, dan pengelolaan layanan. Infrastruktur hosting pelanggan disediakan serta dioperasikan di luar aplikasi ini."],
  ["Apakah estimasi performa merupakan jaminan?", "Bukan. Estimasi bersifat deterministik berdasarkan CPU, RAM, dan faktor performa tier. Hasil aktual dipengaruhi beban kerja serta konfigurasi di luar perancang."],
  ["Bisakah konfigurasi diubah setelah pembayaran?", "Periksa konfigurasi sebelum membayar. Pembelian bersifat final dan perubahan bergantung pada penilaian operasional WangStore."],
  ["Bagaimana harga dihitung?", "Tier Low memakai rumus berdasarkan CPU, RAM, dan penyimpanan. Tier High memakai harga final paket. API selalu menghitung ulang harga dan mengabaikan harga yang dikirim peramban."]
] as const;

export default async function HomePage() {
  const products = await listProducts();
  return <>
    <section className="container-page pb-14 pt-16 sm:pb-20 sm:pt-24 lg:pb-24 lg:pt-32">
      <div className="grid items-end gap-10 lg:grid-cols-[1.25fr_.75fr]">
        <div><Badge>Platform hosting yang jelas dan sederhana</Badge><h1 className="display mt-6 max-w-4xl">Bangun server sesuai kebutuhan, tanpa proses yang rumit.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-secondary">WangStore membantu Anda memilih konfigurasi, melihat harga secara langsung, membuat pesanan, dan mengelola layanan dalam satu portal.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/server-builder" className={linkButton("primary", "lg")}>Buat Server <ArrowRight className="h-4 w-4"/></Link><Link href="#paket" className={linkButton("secondary", "lg")}>Lihat Paket</Link></div></div>
        <Card className="bg-primary p-6 text-background sm:p-8"><p className="text-sm opacity-65">Mulai dari Tier Low</p><p className="mt-3 text-3xl font-semibold">{formatRupiah(45_000)}<span className="text-sm font-normal opacity-65">/bulan</span></p><div className="my-6 border-t border-background/20"/><ul className="space-y-3 text-sm"><li className="flex gap-2"><Check className="h-4 w-4 shrink-0"/>CPU mulai 2 vCore</li><li className="flex gap-2"><Check className="h-4 w-4 shrink-0"/>RAM mulai 4 GB</li><li className="flex gap-2"><Check className="h-4 w-4 shrink-0"/>Penyimpanan mulai 20 GB</li></ul></Card>
      </div><div className="mt-14"><TrustPrinciples/></div>
    </section>

    <section id="paket" className="border-y bg-surface"><div className="container-page section-space"><div className="max-w-2xl"><p className="eyebrow">Layanan</p><h2 className="heading-1">Pilihan yang dapat dipahami.</h2><p className="mt-4 leading-7 text-secondary">Katalog berasal dari database. Hanya produk yang diaktifkan dan ditampilkan oleh pengelola yang muncul di sini.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{products.map((product) => <Card className="flex flex-col bg-background" key={product.id}><div className="flex items-center justify-between gap-3"><Badge>{product.tier ? `Tier ${product.tier}` : product.serviceType.toUpperCase()}</Badge><span className="text-xs text-secondary">{product.status === "available" ? "Tersedia" : product.status === "ongoing" ? "Sedang dipersiapkan" : "Tidak tersedia"}</span></div><h3 className="heading-3 mt-5">{product.name}</h3><p className="mt-3 flex-1 text-sm leading-6 text-secondary">{product.description}</p><Link href={product.serviceType === "vps" ? "/vps" : "/server-builder"} className="mt-6 inline-flex items-center gap-2 text-sm font-medium">Lihat konfigurasi <ArrowRight className="h-4 w-4"/></Link></Card>)}</div></div></section>

    <section className="container-page section-space"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">Perancang Server</p><h2 className="heading-1">Satu perancang, empat keputusan.</h2><p className="mt-4 leading-7 text-secondary">Konfigurasi dibatasi pada tier, CPU, RAM, dan penyimpanan agar proses tetap cepat. Tidak ada tambahan atau biaya wilayah tersembunyi.</p><Link href="/server-builder" className={`${linkButton("secondary")} mt-6`}>Buka Perancang Server</Link></div><div className="grid gap-4 sm:grid-cols-2"><Card><Settings2 className="h-5 w-5"/><h3 className="heading-3 mt-5">Konfigurasi terarah</h3><p className="mt-2 text-sm leading-6 text-secondary">Batas dan langkah input mencegah pilihan di luar spesifikasi yang tersedia.</p></Card><Card><Layers3 className="h-5 w-5"/><h3 className="heading-3 mt-5">Estimasi waktu nyata</h3><p className="mt-2 text-sm leading-6 text-secondary">TPS, pemain, beban CPU, penggunaan RAM, jumlah plugin, dan kelas konfigurasi diperbarui dari model bersama.</p></Card><Card><ShieldCheck className="h-5 w-5"/><h3 className="heading-3 mt-5">Validasi sisi server</h3><p className="mt-2 text-sm leading-6 text-secondary">Tier, paket, kupon, dan harga diverifikasi ulang sebelum pesanan dibuat.</p></Card><Card><LifeBuoy className="h-5 w-5"/><h3 className="heading-3 mt-5">Jalur bantuan jelas</h3><p className="mt-2 text-sm leading-6 text-secondary">Gunakan tiket atau kanal kontak yang benar-benar dikonfigurasi bila membutuhkan konsultasi.</p></Card></div></div></section>

    <section className="border-y bg-surface"><div className="container-page section-space"><p className="eyebrow">Cara kerja</p><h2 className="heading-1">Dari pilihan hingga pesanan.</h2><div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-4">{steps.map(([number, title, description]) => <div className="bg-background p-6" key={number}><p className="text-xs font-semibold text-subtle">{number}</p><h3 className="heading-3 mt-6">{title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{description}</p></div>)}</div></div></section>

    <section className="container-page section-space"><div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><p className="eyebrow">Pertanyaan Umum</p><h2 className="heading-1">Informasi sebelum memesan.</h2><p className="mt-4 leading-7 text-secondary">Baca jawaban dasar atau buka halaman FAQ untuk kebijakan dan penjelasan lebih lengkap.</p><Link href="/faq" className="mt-5 inline-flex items-center gap-2 text-sm font-medium">Buka semua FAQ <ArrowRight className="h-4 w-4"/></Link></div><div className="divide-y border-y">{faqs.map(([question, answer]) => <details className="group py-5" key={question}><summary className="cursor-pointer list-none pr-8 font-medium marker:hidden">{question}</summary><p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">{answer}</p></details>)}</div></div></section>

    <section className="container-page pb-16 sm:pb-24"><div className="rounded-2xl bg-primary px-6 py-12 text-background sm:px-10 lg:flex lg:items-center lg:justify-between"><div><p className="text-sm opacity-65">Rancang Server Sesuai Kebutuhan.</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Siap menyusun konfigurasi Anda?</h2><p className="mt-3 max-w-xl text-sm leading-6 opacity-70">Mulai dari kebutuhan yang nyata. Harga dan estimasi diperbarui sebelum Anda membuat pesanan.</p></div><Link href="/server-builder" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-background px-5 font-medium text-primary lg:mt-0">Mulai Sekarang <ArrowRight className="ml-2 h-4 w-4"/></Link></div></section>
  </>;
}

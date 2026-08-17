import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AnnouncementBar } from "@/components/announcement-bar";
import { getSessionUser } from "@/lib/auth";
import { getPublicSetting,listPublicAnnouncements } from "@/lib/db/repository";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "WangStore — Rancang Server Sesuai Kebutuhan.", template: "%s — WangStore" },
  description: "Platform untuk memilih, memesan, dan mengelola layanan hosting dengan konfigurasi serta harga yang transparan.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "id_ID", siteName: "WangStore", title: "WangStore — Rancang Server Sesuai Kebutuhan.", description: "Pilih konfigurasi server, tinjau harga, dan kelola layanan melalui satu platform." },
  twitter: { card: "summary_large_image", title: "WangStore", description: "Rancang Server Sesuai Kebutuhan." },
  robots: { index: true, follow: true }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }] };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user,siteName,siteDescription,announcements] = await Promise.all([getSessionUser(),getPublicSetting("site_name","WangStore"),getPublicSetting("site_description","Platform penjualan dan pengelolaan layanan hosting yang sederhana, transparan, dan siap membantu proses pemesanan Anda."),listPublicAnnouncements()]);
  const organization = { "@context": "https://schema.org", "@type": "Organization", name: siteName, url: appUrl, description: "Platform penjualan dan pengelolaan layanan hosting." };
  return <html lang="id" suppressHydrationWarning>
    <head><Script id="theme-init" strategy="beforeInteractive">{`try{var t=localStorage.getItem('wangstore-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`}</Script></head>
    <body className="min-h-screen antialiased"><a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm text-background focus:translate-y-0">Lewati ke konten utama</a><AnnouncementBar items={announcements}/><Navbar user={user} siteName={siteName}/><main id="main-content" className="min-h-[65vh]">{children}</main><Footer siteName={siteName} siteDescription={siteDescription}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replaceAll("<", "\\u003c") }}/></body>
  </html>;
}

import Link from "next/link";
import { Menu, Server } from "lucide-react";
import type { SessionUser } from "@/types";
import { linkButton } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/server-builder", label: "Perancang Server" },
  { href: "/features", label: "Fitur" },
  { href: "/vps", label: "VPS" },
  { href: "/knowledge-base", label: "Bantuan" },
  { href: "/about", label: "Tentang" }
];
export function Navbar({ user, siteName = "WangStore" }: { user: SessionUser | null; siteName?: string }) {
  return <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="container-page flex h-16 items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-background"><Server className="h-4 w-4"/></span>{siteName}</Link>
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">{links.map((link) => <Link className="rounded-lg px-3 py-2 text-sm text-secondary hover:bg-surface hover:text-primary" href={link.href} key={link.href}>{link.label}</Link>)}</nav>
      <div className="hidden items-center gap-2 sm:flex"><ThemeToggle/>{user ? <Link href={user.role === "customer" ? "/dashboard" : "/admin"} className={linkButton("secondary", "sm")}>{user.role === "customer" ? "Portal Pelanggan" : "Panel Administrasi"}</Link> : <Link href="/login" className={linkButton("secondary", "sm")}>Masuk</Link>}<Link href="/server-builder" className={linkButton("primary", "sm")}>Rancang Server</Link></div>
      <details className="relative sm:hidden"><summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border" aria-label="Buka navigasi"><Menu className="h-5 w-5"/></summary><div className="absolute right-0 top-12 w-72 rounded-2xl border bg-background p-3 shadow-soft"><nav className="flex flex-col" aria-label="Navigasi seluler">{links.map((link) => <Link className="rounded-lg px-3 py-3 text-sm text-secondary hover:bg-surface hover:text-primary" href={link.href} key={link.href}>{link.label}</Link>)}<div className="my-2 border-t"/><Link className="rounded-lg px-3 py-3 text-sm" href={user ? (user.role === "customer" ? "/dashboard" : "/admin") : "/login"}>{user ? (user.role === "customer" ? "Portal Pelanggan" : "Panel Administrasi") : "Masuk"}</Link><Link className={linkButton("primary", "md")} href="/server-builder">Rancang Server</Link></nav></div></details>
    </div>
  </header>;
}

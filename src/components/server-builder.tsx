"use client";
import { useMemo, useState, type FormEvent } from "react";
import { Check, RotateCcw, Save, ShoppingCart } from "lucide-react";
import type { CatalogPackage, SessionUser, Tier } from "@/types";
import { Alert, Badge, Button, Card, Checkbox, Input, Slider, Textarea, linkButton } from "@/components/ui";
import { estimateConfiguration, formatRupiah, HIGH_PACKAGES, LOW_LIMITS, priceConfiguration, TIER_DEFINITIONS, type Configuration } from "@/lib/pricing";
import { orderMessage, PURCHASE_WARNING, whatsappUrl } from "@/lib/whatsapp";
import { Turnstile } from "@/components/turnstile";

interface ApiResult { success: boolean; data?: { confirmationUrl: string; whatsappUrl: string }; message?: string }
const defaults: Configuration = { tier: "low", cpu: 2, ram: 4, storage: 20, packageId: null };
const tierOptions: Tier[] = ["low", "medium", "high"];
function FieldLabel({ label, value, unit }: { label: string; value: number; unit: string }) { return <div className="mb-3 flex items-center justify-between"><label className="text-sm font-medium" htmlFor={`builder-${label.toLowerCase()}`}>{label}</label><span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold">{value} {unit}</span></div>; }

export function ServerBuilder({ user, whatsappNumber, mediumPackages, mediumAvailable }: { user: SessionUser | null; whatsappNumber: string; mediumPackages:CatalogPackage[];mediumAvailable:boolean }) {
  const [configuration, setConfiguration] = useState<Configuration>(defaults);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const priced = useMemo(() => {
    if (configuration.tier === "medium" && !mediumAvailable) return null;
    try { return { ...priceConfiguration(configuration,mediumPackages), estimate: estimateConfiguration(configuration,mediumPackages) }; } catch { return null; }
  }, [configuration,mediumAvailable,mediumPackages]);

  function chooseTier(tier: Tier): void {
    if (tier === "low") setConfiguration(defaults);
    else if (tier === "medium") {const item=mediumPackages[0];setConfiguration(item?{tier,packageId:item.id,cpu:item.cpu,ram:item.ram,storage:item.storage}:{tier,cpu:0,ram:0,storage:0,packageId:null});}
    else { const item = HIGH_PACKAGES[0]; setConfiguration({ tier, packageId: item.id, cpu: item.cpu, ram: item.ram, storage: item.storage }); }
    setMessage(null);
  }
  function selectPackage(packageId: string): void {
    const item = HIGH_PACKAGES.find((entry) => entry.id === packageId);
    if (item) setConfiguration({ tier: "high", packageId: item.id, cpu: item.cpu, ram: item.ram, storage: item.storage });
  }
  function selectMediumPackage(packageId:string):void{const item=mediumPackages.find((entry)=>entry.id===packageId);if(item)setConfiguration({tier:"medium",packageId:item.id,cpu:item.cpu,ram:item.ram,storage:item.storage})}
  function reset(): void { setConfiguration(defaults); setMessage({ tone: "info", text: "Konfigurasi dikembalikan ke nilai minimum Tier Low." }); }
  async function save(): Promise<void> {
    if (!priced) {
      setMessage({ tone: "error", text: "Pilih konfigurasi yang tersedia sebelum menyimpan." });
      return;
    }
    const payload = { ...priced.config, name: `Konfigurasi ${TIER_DEFINITIONS[configuration.tier].label}` };
    localStorage.setItem("wangstore-saved-configuration", JSON.stringify(payload));
    if (user) {
      try {
        const response = await fetch("/api/account/configurations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json() as ApiResult;
        if (!response.ok) throw new Error(result.message ?? "Konfigurasi akun tidak dapat disimpan.");
        setMessage({ tone: "success", text: "Konfigurasi disimpan di perangkat dan akun Anda." });
      } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Konfigurasi akun tidak dapat disimpan." }); }
    } else setMessage({ tone: "success", text: "Konfigurasi disimpan di perangkat ini. Masuk untuk menyimpannya ke akun." });
  }
  function openFallback(form: HTMLFormElement): void {
    if (!priced) return;
    const fields = new FormData(form);
    const draft = {
      id: "DRAF-BELUM-RESMI", name: String(fields.get("name") ?? ""), whatsapp: String(fields.get("whatsapp") ?? ""), email: String(fields.get("email") ?? ""),
      tier: priced.config.tier, packageId: priced.config.packageId ?? null, cpu: priced.config.cpu, ram: priced.config.ram, storage: priced.config.storage,
      subtotal: priced.price, couponCode: String(fields.get("coupon") ?? "") || null, discount: 0, total: priced.price
    };
    window.open(whatsappUrl(whatsappNumber, `${orderMessage(draft)}\n\nCatatan: Ringkasan ini belum menjadi pesanan resmi karena API tidak dapat dihubungi.`), "_blank", "noopener,noreferrer");
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!priced) return;
    const form = event.currentTarget; const fields = new FormData(form);
    const payload = { name: fields.get("name"), whatsapp: fields.get("whatsapp"), email: fields.get("email"), serverName: fields.get("serverName"), note: fields.get("note"), coupon: fields.get("coupon"), acceptedPolicy: fields.get("acceptedPolicy") === "on", turnstileToken: fields.get("cf-turnstile-response") || undefined, ...configuration, clientPrice: 1 };
    setSubmitting(true); setMessage(null);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.data) throw new Error(result.message ?? "Pesanan tidak dapat dibuat.");
      window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer");
      window.location.assign(result.data.confirmationUrl);
    } catch (error) {
      const isNetwork = error instanceof TypeError;
      if (isNetwork) { openFallback(form); setMessage({ tone: "error", text: "Jaringan bermasalah. WhatsApp dibuka dengan ringkasan lokal, tetapi pesanan belum resmi dan belum tersimpan." }); }
      else setMessage({ tone: "error", text: error instanceof Error ? error.message : "Pesanan tidak dapat dibuat." });
    } finally { setSubmitting(false); }
  }

  return <form onSubmit={submit} className="space-y-8">
    <section aria-labelledby="step-tier"><div className="mb-5"><p className="text-xs font-semibold text-subtle">LANGKAH 1</p><h2 id="step-tier" className="heading-2 mt-2">Pilih tier prosesor</h2></div><div className="grid gap-3 md:grid-cols-3">{tierOptions.map((tier) => { const item = TIER_DEFINITIONS[tier]; const selected = configuration.tier === tier; return <button type="button" key={tier} onClick={() => chooseTier(tier)} aria-pressed={selected} className={`rounded-2xl border p-5 text-left transition-colors ${selected ? "border-primary bg-primary text-background" : "bg-surface hover:bg-muted"}`}><div className="flex items-center justify-between"><span className="font-semibold">{item.label}</span>{selected && <Check className="h-4 w-4"/>}</div><p className={`mt-3 text-sm ${selected ? "opacity-70" : "text-secondary"}`}>{item.processor}</p><p className={`mt-4 text-xs ${selected ? "opacity-60" : "text-subtle"}`}>{tier === "medium"&&!mediumAvailable ? "Sedang dipersiapkan" : item.mode === "custom" ? "Konfigurasi khusus" : "Paket tetap"}</p></button>; })}</div></section>

    <section aria-labelledby="step-config"><div className="mb-5"><p className="text-xs font-semibold text-subtle">LANGKAH 2</p><h2 id="step-config" className="heading-2 mt-2">Atur konfigurasi</h2></div>
      {configuration.tier === "low" && <Card className="space-y-7 bg-background"><div><FieldLabel label="CPU" value={configuration.cpu} unit="vCore"/><Slider id="builder-cpu" min={LOW_LIMITS.cpu.min} max={LOW_LIMITS.cpu.max} step={LOW_LIMITS.cpu.step} value={configuration.cpu} onChange={(event) => setConfiguration((current) => ({ ...current, cpu: Number(event.target.value) }))}/><div className="mt-2 flex justify-between text-xs text-subtle"><span>2 vCore</span><span>16 vCore</span></div></div><div><FieldLabel label="RAM" value={configuration.ram} unit="GB"/><Slider id="builder-ram" min={LOW_LIMITS.ram.min} max={LOW_LIMITS.ram.max} step={LOW_LIMITS.ram.step} value={configuration.ram} onChange={(event) => setConfiguration((current) => ({ ...current, ram: Number(event.target.value) }))}/><div className="mt-2 flex justify-between text-xs text-subtle"><span>4 GB</span><span>32 GB</span></div></div><div><FieldLabel label="Penyimpanan" value={configuration.storage} unit="GB"/><Slider id="builder-penyimpanan" min={LOW_LIMITS.storage.min} max={LOW_LIMITS.storage.max} step={LOW_LIMITS.storage.step} value={configuration.storage} onChange={(event) => setConfiguration((current) => ({ ...current, storage: Number(event.target.value) }))}/><div className="mt-2 flex justify-between text-xs text-subtle"><span>20 GB</span><span>160 GB</span></div></div></Card>}
      {configuration.tier === "high" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{HIGH_PACKAGES.map((item) => <button type="button" key={item.id} onClick={() => selectPackage(item.id)} aria-pressed={configuration.packageId === item.id} className={`rounded-2xl border p-5 text-left ${configuration.packageId === item.id ? "border-primary bg-primary text-background" : "bg-surface hover:bg-muted"}`}><div className="flex justify-between gap-2"><span className="font-semibold">{item.cpu} inti · {item.ram} GB</span>{"popular" in item && item.popular && <Badge className={configuration.packageId === item.id ? "border-background/30 bg-background/10 text-background" : ""}>Populer</Badge>}</div><p className={`mt-2 text-sm ${configuration.packageId === item.id ? "opacity-70" : "text-secondary"}`}>{item.storage} GB Penyimpanan</p><p className="mt-5 font-semibold">{formatRupiah(item.price)}<span className="text-xs font-normal opacity-60">/bulan</span></p></button>)}</div>}
      {configuration.tier === "medium"&&mediumAvailable&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mediumPackages.map(item=><button type="button" key={item.id} onClick={()=>selectMediumPackage(item.id)} aria-pressed={configuration.packageId===item.id} className={`rounded-2xl border p-5 text-left ${configuration.packageId===item.id?"border-primary bg-primary text-background":"bg-surface hover:bg-muted"}`}><span className="font-semibold">{item.name}</span><p className={`mt-2 text-sm ${configuration.packageId===item.id?"opacity-70":"text-secondary"}`}>{item.cpu} inti · {item.ram} GB RAM · {item.storage} GB Penyimpanan</p><p className="mt-5 font-semibold">{formatRupiah(item.price)}<span className="text-xs font-normal opacity-60">/bulan</span></p></button>)}</div>}
      {configuration.tier === "medium"&&!mediumAvailable && <Alert title="Tier Medium sedang dipersiapkan" tone="warning"><p>Paket Medium sedang dipersiapkan dan belum tersedia untuk pemesanan.</p><Button className="mt-4" type="button" disabled>Paket Belum Tersedia</Button></Alert>}
    </section>

    {priced && <section aria-labelledby="step-estimate"><div className="mb-5"><p className="text-xs font-semibold text-subtle">LANGKAH 3</p><h2 id="step-estimate" className="heading-2 mt-2">Tinjau estimasi</h2></div><div className="grid gap-5 lg:grid-cols-[.65fr_1.35fr]"><Card className="bg-primary text-background"><p className="text-sm opacity-65">Harga bulanan</p><p className="mt-2 text-3xl font-semibold">{formatRupiah(priced.price)}</p><p className="mt-2 text-xs opacity-60">Harga dihitung ulang oleh API saat pesanan dibuat.</p></Card><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Card><p className="text-xs text-subtle">Estimasi TPS</p><p className="mt-2 font-semibold">{priced.estimate.tps}</p></Card><Card><p className="text-xs text-subtle">Estimasi pemain konkuren</p><p className="mt-2 font-semibold">{priced.estimate.concurrentPlayers}</p></Card><Card><p className="text-xs text-subtle">Estimasi beban CPU</p><p className="mt-2 font-semibold">{priced.estimate.cpuLoad}</p></Card><Card><p className="text-xs text-subtle">Estimasi penggunaan RAM</p><p className="mt-2 font-semibold">{priced.estimate.ramUsage}</p></Card><Card><p className="text-xs text-subtle">Estimasi jumlah plugin</p><p className="mt-2 font-semibold">{priced.estimate.recommendedPlugins}</p></Card><Card><p className="text-xs text-subtle">Estimasi kelas konfigurasi</p><p className="mt-2 font-semibold">Kelas {priced.estimate.grade}</p></Card></div></div><p className="mt-4 text-xs leading-5 text-subtle">Seluruh hasil di atas adalah estimasi deterministik berdasarkan CPU, RAM, dan faktor performa tier. Estimasi bukan SLA atau jaminan performa aktual.</p></section>}

    <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={save} disabled={!priced}><Save className="h-4 w-4"/>Simpan konfigurasi</Button><Button type="button" variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4"/>Atur ulang</Button></div>

    {priced&&!user&&<section aria-labelledby="step-account"><div className="mb-5"><p className="text-xs font-semibold text-subtle">LANGKAH 4</p><h2 id="step-account" className="heading-2 mt-2">Masuk sebelum memesan</h2></div><Alert title="Akun pelanggan diperlukan">Pesanan harus terhubung ke akun agar pembayaran dapat dikonfirmasi dan layanan dapat dikelola dengan aman. Konfigurasi Anda tetap tersimpan di perangkat ini.</Alert><div className="mt-4 flex flex-wrap gap-3"><a className={linkButton("primary")} href="/login?next=/server-builder">Masuk</a><a className={linkButton("secondary")} href="/register">Buat Akun</a></div></section>}
    {priced&&user&&<section aria-labelledby="step-order"><div className="mb-5"><p className="text-xs font-semibold text-subtle">LANGKAH 4</p><h2 id="step-order" className="heading-2 mt-2">Informasi pemesanan</h2><p className="mt-2 text-sm text-secondary">Data ini digunakan untuk mencatat pesanan dan melanjutkan percakapan melalui WhatsApp.</p></div><div className="grid gap-8 lg:grid-cols-[1fr_.6fr]"><Card className="space-y-5 bg-background"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Nama<Input className="mt-2" name="name" required minLength={2} defaultValue={user?.name ?? ""} autoComplete="name"/></label><label className="text-sm font-medium">WhatsApp<Input className="mt-2" name="whatsapp" required pattern="^\+?[0-9]{9,15}$" placeholder="628123456789" autoComplete="tel"/></label></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Email<Input className="mt-2" name="email" type="email" required defaultValue={user?.email ?? ""} autoComplete="email"/></label><label className="text-sm font-medium">Nama server<Input className="mt-2" name="serverName" required minLength={2} placeholder="Nama proyek atau server"/></label></div><label className="block text-sm font-medium">Catatan <span className="font-normal text-subtle">(opsional)</span><Textarea className="mt-2" name="note" maxLength={1000} placeholder="Kebutuhan atau pertanyaan yang perlu diketahui petugas."/></label><label className="block text-sm font-medium">Kupon <span className="font-normal text-subtle">(opsional)</span><Input className="mt-2 uppercase" name="coupon" maxLength={40} placeholder="Kode kupon"/></label><Turnstile/><label className="flex items-start gap-3 rounded-xl border bg-surface p-4 text-sm leading-6"><Checkbox name="acceptedPolicy" required className="mt-1 shrink-0"/><span>Saya telah memeriksa konfigurasi dan menyetujui <a href="/terms" className="font-medium underline">Ketentuan</a>, <a href="/refund" className="font-medium underline">Kebijakan Pengembalian Dana</a>, serta <a href="/sla" className="font-medium underline">SLA</a> WangStore.</span></label></Card><div className="space-y-4"><Alert title="Perhatikan sebelum membeli" tone="warning">{PURCHASE_WARNING}</Alert><Card><div className="flex justify-between text-sm"><span className="text-secondary">Tier</span><span className="font-medium">{configuration.tier.toUpperCase()}</span></div><div className="mt-3 flex justify-between text-sm"><span className="text-secondary">CPU / RAM / Penyimpanan</span><span className="font-medium">{priced.config.cpu} / {priced.config.ram} / {priced.config.storage}</span></div><div className="my-4 border-t"/><div className="flex items-end justify-between"><span className="text-sm text-secondary">Subtotal</span><span className="text-xl font-semibold">{formatRupiah(priced.price)}</span></div><Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}><ShoppingCart className="h-4 w-4"/>{submitting ? "Membuat pesanan…" : "Pesan Sekarang"}</Button><p className="mt-3 text-center text-xs leading-5 text-subtle">Pesanan dibuat dengan status menunggu. Pembayaran tidak pernah dinyatakan berhasil secara otomatis.</p></Card></div></div></section>}
    {message && <div className="sticky bottom-4 z-20"><Alert title={message.tone === "success" ? "Berhasil" : message.tone === "error" ? "Perlu perhatian" : "Informasi"} tone={message.tone}>{message.text}</Alert></div>}
  </form>;
}

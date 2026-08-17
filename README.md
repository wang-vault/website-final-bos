# WangStore

WangStore adalah platform e-commerce/SaaS berbahasa Indonesia untuk memilih, memesan, dan mengelola layanan hosting. Repositori ini **bukan** infrastruktur hosting, control panel Minecraft, atau sistem provisioning. Aplikasi menangani katalog, harga, order, akun pelanggan, tiket, konten, status, dan lifecycle layanan.

## Fitur utama

- Server Builder dengan formula Low terpusat, paket Medium berbasis database, dan paket High dengan harga tetap.
- Perhitungan ulang harga, kupon, serta estimasi performa di server.
- Alur order dengan konfirmasi terproteksi dan kelanjutan melalui WhatsApp tanpa status pembayaran palsu.
- Supabase Auth, portal pelanggan, layanan, renewal, notifikasi, konfigurasi tersimpan, dan tiket.
- Panel Owner/Admin/Staff dengan RBAC untuk katalog, order, customer, lifecycle, VPS, CMS, status, pengaturan, analitik, dan audit.
- PostgreSQL Supabase dengan RLS, RPC transaksi order, rate limit, renewal, dan reminder idempoten.
- SEO, structured data, sitemap, robots, tema terang/gelap, serta tampilan responsif dan aksesibel.
- Turnstile opsional, validasi Zod, Origin/Host check, CSP, security headers, dan payload limits.

## Stack

Next.js 15 App Router, React 19, strict TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth, Zod, `jose`, bcryptjs, lucide-react, React Markdown, dan Vitest.

## Menjalankan secara lokal

Persyaratan: Node.js 20 atau lebih baru.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka `http://localhost:3000`. Jika variabel Supabase belum diisi, mode development memakai datastore JSON atomik di `data/wangstore.local.json`. Datastore ini tidak digunakan dan tidak diizinkan sebagai penyimpanan production.

Untuk menguji autentikasi lokal, daftar melalui `/register`. Email verifikasi lokal dicatat melalui respons development; jangan gunakan mekanisme ini di production.

## Pemeriksaan kualitas

```bash
npm run typecheck
npm run lint
npm test
npm run build
BASE_URL=http://localhost:3000 npm run test:smoke
```

Atau jalankan `npm run check`. Smoke test membutuhkan server yang sudah berjalan.

## Production

Production wajib menggunakan Supabase. Jalankan [`database/schema.sql`](database/schema.sql), konfigurasikan Auth dan environment, lalu deploy ke platform serverless. Instruksi lengkap tersedia di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Jangan menyatakan deployment berhasil sebelum schema, Auth, order, dashboard pelanggan, panel admin, scheduler, dan smoke test production benar-benar diverifikasi.

## Dokumentasi

- [Arsitektur](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Keamanan](docs/SECURITY.md)
- [Referensi API](docs/API.md)
- [Kontribusi](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Lisensi

Kode sumber tersedia dengan [MIT License](LICENSE). Merek, data operasional, kredensial, dan konten pelanggan tidak termasuk dalam pemberian hak atas kode.

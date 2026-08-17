# Deployment Serverless

## 1. Supabase

1. Buat project Supabase pada region yang sesuai.
2. Buka SQL Editor dan jalankan `database/schema.sql` pada project staging terlebih dahulu.
3. Periksa bahwa seluruh table, index, trigger, function, grant, dan RLS policy terbentuk tanpa error.
4. Di Authentication, aktifkan email/password, verifikasi email, Site URL production, dan redirect URL `https://domain/auth/callback` serta `https://domain/reset-password`.
5. Daftarkan akun pertama, lalu promosikan secara eksplisit menjadi Owner memakai petunjuk terakhir di schema. Jangan membuat owner berdasarkan email hardcoded.
6. Uji RLS dengan akun Customer, Staff, Admin, dan Owner sebelum production.

## 2. Environment

Salin nama variabel dari `.env.example` ke environment platform. Wajib untuk production:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `JWT_SECRET` minimal 32 karakter acak
- `RATE_LIMIT_SALT`
- `CRON_SECRET`

Konfigurasikan `WHATSAPP_NUMBER`, kontak, email provider, dan Turnstile bila digunakan. Jangan menaruh service-role key pada variabel `NEXT_PUBLIC_*`.

## 3. Vercel

Import repository sebagai project Next.js, isi environment untuk Preview dan Production secara terpisah, lalu deploy. `vercel.json` menjadwalkan reminder harian. Vercel mengirim `Authorization: Bearer $CRON_SECRET`; pastikan Cron Secret tersedia di environment.

Setelah deploy, jalankan:

```bash
BASE_URL=https://domain-production npm run test:smoke
```

Lanjutkan pengujian manual: register/verifikasi/login/reset, order Low/High/Medium, kupon, ownership konfirmasi, dashboard, tiket, RBAC admin, lifecycle, pembuatan serta konfirmasi pembayaran renewal, reminder, dan logout. Pastikan renewal pending tidak mengubah expiration, konfirmasi memperpanjang tepat satu kali, layanan aktif dihitung dari expiration lama, dan layanan expired dihitung dari waktu database.

## 4. Cloudflare

Gunakan adapter Next.js resmi/terpelihara yang mendukung App Router dan Node.js compatibility (misalnya OpenNext untuk Cloudflare) sesuai dokumentasi versi yang dipakai saat deployment. Jangan menjalankan `next start` sebagai proses permanen pada Worker. Hubungkan Cron Trigger ke Worker yang memanggil `/api/cron/reminders` dengan Bearer secret. Karena dukungan runtime adapter berubah, build dan seluruh alur harus diuji pada environment Preview Cloudflare sebelum production.

## 5. Checklist rilis

- [ ] `npm ci`, typecheck, lint, test, audit, dan build lulus.
- [ ] Schema staging dan production berhasil diterapkan.
- [ ] Auth callback dan email delivery teruji.
- [ ] RLS/RBAC diuji dengan seluruh role.
- [ ] Harga exact, kupon, order transaction, dan Medium state teruji.
- [ ] Customer hanya melihat order/layanan miliknya.
- [ ] Pembayaran tidak ditandai sukses tanpa konfirmasi provider/manual.
- [ ] Cron dan idempotensi reminder teruji.
- [ ] Domain, HTTPS, CSP, Turnstile, kontak, dan WhatsApp terkonfigurasi.
- [ ] Smoke test production lulus dan rollback tersedia.

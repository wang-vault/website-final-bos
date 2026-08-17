# Arsitektur WangStore

## Batas sistem

WangStore adalah control plane komersial: katalog, builder, order, relasi pelanggan, konten, status, dan lifecycle. Provisioning mesin, virtualisasi, panel game, jaringan, serta server pelanggan berada di luar aplikasi. Tidak ada daemon jangka panjang, filesystem production persisten, atau ketergantungan VPS.

## Lapisan aplikasi

1. **UI App Router** — Server Components menjadi default. Client Components hanya dipakai untuk form interaktif, tab, tema, dan Turnstile.
2. **Route handlers** — API selalu dinamis, memvalidasi input dengan Zod, melakukan autentikasi/RBAC, dan mengembalikan envelope JSON konsisten.
3. **Domain** — `src/lib/pricing` adalah satu-satunya sumber formula Low, paket High, pricing Medium yang disuplai repository, serta estimasi. `src/lib/lifecycle` menangani status efektif dan renewal.
4. **Repository** — `src/lib/db/repository.ts` menyediakan operasi domain. Supabase digunakan saat dikonfigurasi; JSON atomik hanya untuk development yang tidak dikonfigurasi.
5. **Database** — `database/schema.sql` berisi tabel, constraint, index, trigger, RLS, RPC transaksi, dan seed produk yang faktual.

## Alur order

Browser mengirim identitas dan konfigurasi tanpa harga tepercaya. API menormalisasi input, memuat produk/paket Medium yang orderable, menghitung ulang subtotal, memvalidasi kupon, lalu memanggil repository. Di Supabase, RPC `create_order_transaction` mengunci kupon, memverifikasi ulang produk/paket/harga, menulis order, item, penggunaan kupon, dan audit dalam satu transaksi. Order awal selalu `pending` dan bukan bukti pembayaran.

## Auth dan RBAC

Supabase Auth digunakan di production. Session aplikasi berada dalam cookie HttpOnly yang ditandatangani; role berasal dari profile/role yang dibaca server. Urutan hak adalah Customer < Staff < Admin < Owner. Route admin memakai minimum role resource dan UI tidak memuat data yang berada di luar wewenang role.

## Lifecycle layanan

Status layanan: `pending`, `scheduled`, `active`, `suspended`, `expired`, `cancelled`, dan `terminated`. Status efektif ditentukan dengan waktu server/database. Hanya satu renewal pending yang diizinkan per layanan dan status pending tidak mengubah expiration. RPC `complete_service_renewal` mengunci renewal beserta layanan, mencatat referensi pembayaran dan audit, lalu memperpanjang layanan aktif dari expiration lama atau layanan expired dari waktu database saat konfirmasi. Pemanggilan ulang konfirmasi bersifat idempoten. Reminder memakai unique key `(service_id, reminder_type)` agar notifikasi tidak digandakan.

## Scheduler

`POST` atau `GET /api/cron/reminders` dijaga `Authorization: Bearer $CRON_SECRET`. Vercel Cron, Cloudflare Cron Trigger melalui worker pemanggil, atau scheduler serverless lain dapat memanggil endpoint setiap hari. Endpoint idempoten untuk interval reminder yang sama.

## Konten

Blog dan Knowledge Base memakai Markdown. FAQ, testimoni terverifikasi, halaman CMS, dokumen legal CMS, insiden, pengumuman, branding, kontak, dan informasi infrastruktur berasal dari repository. Halaman wajib seperti Terms/SLA tetap tersedia sebagai dokumen statis yang direview di kode; dokumen legal CMS diterbitkan pada `/legal/[slug]` agar tidak menimpa dokumen wajib tanpa review.

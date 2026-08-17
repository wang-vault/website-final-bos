# Referensi API

Semua respons sukses memakai `{ "success": true, "data": ... }`. Error memakai `{ "success": false, "code": "...", "message": "...", "issues"?: ... }`. Endpoint write menerima JSON, menerapkan batas payload, validasi Zod, Origin/Host check, dan rate limit sesuai risikonya.

## Publik

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/products` | Produk publik dan status katalog |
| GET | `/api/packages` | Paket Medium yang orderable dan paket High exact |
| GET | `/api/pricing` | Definisi tier; tambahkan `tier`, `cpu`, `ram`, `storage`, dan opsional `packageId` untuk kalkulasi |
| POST | `/api/coupons/validate` | Validasi kupon terhadap konfigurasi yang dihitung server |
| POST | `/api/orders` | Buat order atomik; client price/discount diabaikan |
| GET | `/api/orders/[id]` | Order milik session atau guest token yang valid |
| POST | `/api/contact` | Buat tiket kontak |
| GET | `/api/blog` | Artikel blog published |
| GET | `/api/knowledge-base` | Artikel knowledge base published |
| GET | `/api/status` | Maintenance, insiden published, dan status monitoring |
| GET | `/api/vps` | Katalog VPS berbasis database |
| GET | `/api/vps/[id]` | Detail VPS berdasarkan ID/slug |

Medium yang belum orderable mengembalikan HTTP 409 dari kalkulasi/order, bukan harga Rp0. Paket High palsu mengembalikan HTTP 422.

## Auth

`POST /api/auth/register`, `login`, `logout`, `forgot-password`, `reset-password`, dan `verify-email`. Recovery Supabase memvalidasi access token terhadap Supabase Auth sebelum update password. Turnstile wajib bila secret dikonfigurasi.

## Customer

Endpoint `/api/account/*`, `/api/tickets`, `/api/services`, `/api/services/[id]/renew`, dan `/api/services/[id]/reminders` membutuhkan session. `GET /api/services` mengembalikan layanan beserta riwayat renewal milik customer. Ownership diverifikasi server. Customer tidak dapat mengubah status, waktu layanan, renewability, role, atau harga. Satu layanan hanya dapat memiliki satu renewal pending.

## Admin

- `GET/POST /api/admin/[resource]`
- `PATCH/DELETE /api/admin/[resource]/[id]`
- `POST /api/admin/service-status`
- `POST /api/admin/renewals/[id]/confirm` — konfirmasi pembayaran manual secara idempoten dan perpanjang masa layanan dalam satu transaksi

Resource map pusat menentukan schema, identity field, minimum role, dan pembatasan create/delete. Resource meliputi produk, paket Medium, kupon, VPS/lokasi, order, customer, tiket, layanan, CMS, status, settings, maintenance, dan audit.

## Scheduler

`GET` atau `POST /api/cron/reminders` membutuhkan header `Authorization: Bearer <CRON_SECRET>`. Jangan mengekspos secret pada browser.

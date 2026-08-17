# Keamanan

## Kontrol yang diterapkan

- Zod strict schema dan sanitasi rekursif untuk payload tidak tepercaya.
- Batas body per endpoint dan penolakan field harga dari browser.
- Pemeriksaan Origin/Host untuk operasi write, cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
- CSP, HSTS di production, frame denial, nosniff, Referrer Policy, Permissions Policy, dan noindex area privat.
- Password lokal memakai bcrypt; token session memakai `jose`. Supabase Auth menjadi sumber identitas production.
- Login mengembalikan pesan generik dan memakai perbandingan/password work yang tidak membocorkan keberadaan akun secara langsung.
- Rate limiting serverless melalui RPC Supabase; fallback file hanya tersedia dalam development lokal.
- Cloudflare Turnstile diverifikasi server-side pada order, kontak, registrasi, login, dan forgot password ketika secret dikonfigurasi.
- RBAC selalu ditegakkan di server; visibilitas tombol bukan batas keamanan.
- Audit menyimpan aksi penting tanpa password, token reset, service-role key, atau isi cookie.
- RLS membatasi pembacaan data pelanggan berdasarkan `auth.uid()` dan role.

## Trust boundaries

Harga client, diskon, status pembayaran, role, owner ID, waktu aktivasi/expiration, dan harga renewal tidak pernah dipercaya. Service-role key hanya boleh berada pada environment server. `NEXT_PUBLIC_*` bukan tempat rahasia.

## Operasional

1. Gunakan secret acak minimal 32 byte untuk JWT, rate-limit salt, dan cron.
2. Aktifkan email verification dan atur Site URL/redirect allowlist Supabase.
3. Rotasi key bila log atau environment pernah terekspos.
4. Batasi akses dashboard Supabase dan project deployment dengan MFA.
5. Tinjau audit log, dependency audit, dan failed auth/rate-limit metrics.
6. Backup database menggunakan fasilitas provider dan uji pemulihan secara berkala.

## Pelaporan kerentanan

Jangan membuka issue publik untuk kerentanan. Gunakan kanal privat pemilik repository atau GitHub Security Advisory. Sertakan dampak, langkah reproduksi aman, versi commit, dan mitigasi yang disarankan. Jangan mengakses atau menyalin data pihak lain.

## Batas verifikasi

Schema harus diuji pada project Supabase staging sebelum production. Keberhasilan `npm run build` tidak membuktikan RLS, SMTP, Turnstile, scheduler, atau deployment eksternal sudah benar.

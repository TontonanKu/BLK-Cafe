# BLK CAFE — Full-stack ordering website

Website cafe dengan gaya brutalist minimalis: paper background, bold condensed typography, hitam-putih, aksen kuning/oranye, border tegas, dan layout responsif.

## Stack
- Node.js + Express (API dan static frontend)
- SQLite via `better-sqlite3` (database lokal persisten)
- `express-session` + `bcryptjs` (session login dan password hashing)
- HTML, CSS, JavaScript vanilla (frontend)

## Fitur
- Register, login, logout, session-based authentication
- Katalog menu, kategori, pencarian, badge promo, add to cart
- Promo dan voucher: persen/fixed, minimum order, maksimum diskon, batas penggunaan, tanggal kedaluwarsa
- Checkout tanpa payment gateway
- Dine-in, takeaway, delivery
- Konfirmasi bayar di kasir atau lanjut ke WhatsApp dengan pesan pesanan otomatis
- Kode order dan riwayat pesanan pelanggan
- Admin dashboard: ringkasan, status order, tambah menu, update harga/badge, hide menu, buat/nonaktifkan voucher
- Database otomatis dibuat dan di-seed saat server pertama kali berjalan

## Menjalankan di komputer
1. Install Node.js 18 atau lebih baru: https://nodejs.org/
2. Ekstrak ZIP, buka folder `rrby-cafe` di terminal.
3. Install dependency:
   ```bash
   npm install
   ```
4. (Opsional) Salin `.env.example` menjadi `.env`, lalu ubah secret dan nomor WhatsApp. File `.env` akan dimuat otomatis.
5. Jalankan:
   ```bash
   npm start
   ```
6. Buka `http://localhost:3000`.

## Akun demo admin
- Email: `admin@blokcafe.test`
- Password: `CafeAdmin123!`

Segera ubah kredensial demo dan `SESSION_SECRET` sebelum website dipublikasikan. Kredensial admin awal dibaca dari environment `ADMIN_EMAIL` dan `ADMIN_PASSWORD` ketika database pertama kali dibuat.

## Mengatur WhatsApp
Set environment variable `CAFE_WHATSAPP` ke nomor WhatsApp bisnis dalam format internasional tanpa `+`, contoh `6281234567890`. Ganti juga alamat dummy, jam buka, dan informasi cafe di `public/index.html`.

## Database
File `cafe.sqlite` dibuat otomatis di folder project saat server dijalankan. Backup file tersebut secara berkala. Untuk reset data demo, hentikan server lalu hapus `cafe.sqlite`; data seed akan dibuat ulang ketika server berikutnya berjalan.

## Catatan sebelum production
Demo ini cocok untuk dijalankan lokal dan dikembangkan lebih lanjut. Sebelum dipakai publik, gunakan HTTPS, secret session yang kuat, persistent session store, validasi rate limit, backup database, kebijakan privasi, serta deploy di hosting yang mendukung Node.js dan penyimpanan database persisten. WhatsApp hanya dibuka sebagai draft pesan; pengiriman tetap dilakukan pelanggan dengan menekan tombol Send. Tidak ada payment gateway.

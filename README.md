# BLK CAFE — Full-stack Ordering Website (Serverless Ready)

Website cafe dengan gaya brutalist minimalis: paper background, bold condensed typography, hitam-putih, aksen kuning/oranye, border tegas, dan layout responsif.

## Stack Modern & Serverless
- **Runtime & API**: Node.js + Express
- **Database**: Turso (SQLite over HTTP / Serverless SQLite via `@libsql/client`) dengan fallback otomatis ke file SQLite lokal saat offline/development.
- **Autentikasi**: Stateless JWT Cookie-based Auth (`jsonwebtoken` + `cookie-parser`) — 100% kompatibel dengan serverless AWS Lambda & Vercel.
- **Penyimpanan Foto (Object Storage)**: Cloudinary SDK untuk simpan gambar menu secara permanen di cloud (dengan fallback otomatis).
- **Frontend**: HTML5, CSS3 Brutalist, Vanilla JavaScript (zero bundle size, ultra cepat).
- **Deployment Target**: Vercel, Render, Railway, VPS, atau Localhost.

## Fitur Utama
- **Layanan Dine-in Otomatis**: Deteksi meja via link URL / scan QR (contoh: `?table=05`).
- **QR Meja Generator**: Admin panel untuk membuat & mencetak kartu stand meja / stiker lembar A4 QR Code.
- **Cetak Struk Kasir (Thermal Receipt)**: Format struk kasir 58mm/80mm instan via browser print.
- **Bel Notifikasi Suara**: Audio chime ganda otomatis (Web Audio API native) saat pesanan baru masuk ke kasir.
- **Dietary & Flavor Badges**: Tag rasa (Pedas, Kopi, Dingin, Best Seller, Veggie) dengan pemilihan instan di admin dan filter pencarian.
- **Katalog & Keranjang**: Pencarian menu, filter kategori, diskon voucher promo.
- **Admin Dashboard**: Kelola status order, tambah menu (drag & drop / link), upload foto, kelola kuota voucher promo, dan generator QR meja.

## Cara Deploy ke Vercel

1. Buat database gratis di **[Turso](https://turso.tech)** (Gratis hingga 500 database SQLite):
   ```bash
   # Menggunakan CLI atau Web Dashboard Turso:
   turso db create blk-cafe
   turso db show --url blk-cafe
   turso db tokens create blk-cafe
   ```
2. (Opsional) Buat akun gratis di **[Cloudinary](https://cloudinary.com)** untuk penyimpanan foto produk.
3. Buka **[Vercel](https://vercel.com)** ➔ Klik **Add New Project** ➔ Import repositori **`TontonanKu/BLK-Cafe`**.
4. Di bagian **Environment Variables**, tambahkan:
   - `TURSO_DATABASE_URL` = `libsql://blk-cafe-youruser.turso.io`
   - `TURSO_AUTH_TOKEN` = `your-turso-auth-token`
   - `CLOUDINARY_CLOUD_NAME` = `your-cloud-name` (opsional)
   - `CLOUDINARY_API_KEY` = `your-api-key` (opsional)
   - `CLOUDINARY_API_SECRET` = `your-api-secret` (opsional)
   - `JWT_SECRET` = `kunci-rahasia-jwt-kamu`
5. Klik **Deploy**! Web kamu akan langsung online dan siap digunakan di Vercel.

## Menjalankan di Komputer Lokal

1. Pastikan Node.js 18+ sudah terinstall: https://nodejs.org/
2. Buka folder project di terminal:
   ```bash
   npm install
   ```
3. Jalankan server:
   ```bash
   npm start
   ```
4. Buka di browser: `http://localhost:3000`

## Akun Demo Admin
- **Email**: `admin@blokcafe.test`
- **Password**: `CafeAdmin123!`

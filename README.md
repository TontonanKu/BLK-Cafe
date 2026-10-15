# BLK CAFE — Modern Dine-In Cafe Web App (Zero-Config / Vercel & GitHub Pages Ready)

Website pemesanan cafe dengan gaya desain brutalist minimalis: paper background, bold condensed typography, palet kontras hitam-putih dengan aksen oranye/kuning, border tegas, dan layout mobile-friendly responsif.

Didesain khusus agar **langsung jalan tanpa ribet**:
- ⚡ **Zero-Config Deployment**: Siap langsung dideploy ke **Vercel** atau **GitHub Pages** hanya dengan 1-klik tanpa perlu setting database eksternal (Turso/Supabase/Neon), tanpa token, dan tanpa environment variables!
- 💾 **Client-Side Persistence**: Semua data (menu, voucher, pesanan, foto menu) tersimpan rapi dan persisten di browser (`localStorage`), sehingga tester atau reviewer bisa langsung mencoba semua fitur CRUD tanpa hambatan koneksi server.
- 🔄 **Reset Demo Data**: Terdapat tombol "RESET DEMO" di header admin untuk mengembalikan semua data ke setelan sampel awal dalam 1 klik.

---

## 🚀 Fitur Lengkap Siap Pakai

1. **Layanan Dine-in Otomatis via QR Meja**:
   - Deteksi nomor meja langsung dari parameter URL (misal: `?table=05` atau `?table=Bar 01`).
   - Muncul banner meja aktif di atas web & otomatis mengisi nomor meja di form checkout.

2. **Katalog Menu & Keranjang Belanja**:
   - 8 menu bawaan siap saji (Smash Burger, Crispy Chicken Burger, Brown Sugar Latte, Matcha Cloud, dll).
   - Filter kategori (Food, Snacks, Drinks, Sweets) & pencarian real-time.
   - Tag dietary / rasa (🌶️ Pedas, ☕ Kopi, 🧊 Dingin, ⭐ Best Seller, 🔥 Favorit, 🌱 Veggie).
   - Pengaturan kuantiti (+/-), catatan khusus per pesanan, dan subtotal otomatis.

3. **Promo & Voucher Diskon**:
   - Kode promo aktif:
     - `KENALAN` — Diskon 20% (maksimal Rp15.000) min. belanja Rp50.000.
     - `HEMAT10` — Potongan nominal Rp10.000 min. belanja Rp75.000.
   - Validasi batas minimal belanja & kalkulasi diskon otomatis.

4. **Sistem Pesanan Makan di Tempat (Dine-In)**:
   - Form checkout nomor meja & instruksi ke kasir.
   - Pembuatan Kode Order unik instan (contoh: `BLK-718293`).
   - Riwayat pesanan pelanggan.

5. **Panel Kasir & Admin Lengkap**:
   - **Login Admin**: Email `admin@blokcafe.test` / Password `CafeAdmin123!` (tersedia tombol ⚡ *Login Admin Instan* di form login).
   - **Manajemen Pesanan**: Ganti status pesanan (Menunggu Konfirmasi ➔ Dikonfirmasi ➔ Diproses ➔ Siap Diambil ➔ Selesai / Dibatalkan).
   - **Cetak Struk Kasir (Thermal Receipt)**: Format struk kasir 58mm/80mm siap cetak langsung via `window.print()`.
   - **Bel Notifikasi Suara**: Audio chime ganda otomatis (Web Audio API) saat pesanan baru masuk atau saat ditest kasir.
   - **Menu Manager**: Tambah menu baru, edit nama/harga/kategori/badge, sembunyikan menu, serta ubah foto lewat URL atau **Drag & Drop / Upload File** (otomatis dikompres via HTML5 Canvas agar ringan).
   - **Voucher Manager**: Tambah voucher baru (tipe diskon %, potongan nominal, min. belanja, kuota, tanggal kedaluwarsa) dan toggle aktif/nonaktif.
   - **QR Meja Generator & Stiker Cetak**: Generator kartu stand QR tiap meja dan lembar cetak stiker A4 Meja 01 s/d Meja 10 siap cetak & tempel di meja cafe.

---

## 📦 Cara Deploy ke Vercel (1-Click, Zero Config)

1. Buka [Vercel](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik tombol **Add New...** ➔ **Project**.
3. Pilih repositori **`BLK-Cafe`** (atau `TontonanKu/BLK-Cafe`).
4. **Langsung klik Deploy** (Tidak perlu isi Environment Variables, tidak perlu ubah Build Command).
5. Dalam beberapa detik web sudah aktif online di URL Vercel Anda (`https://your-project.vercel.app`)!

---

## 🌐 Cara Mengaktifkan di GitHub Pages

1. Buka repositori Anda di GitHub: `https://github.com/TontonanKu/BLK-Cafe`.
2. Klik tab **Settings** ➔ pilih menu **Pages** di sebelah kiri.
3. Di bagian **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: pilih `main` dan folder `/(root)`
4. Klik **Save**.
5. Tunggu sekitar 1-2 menit, web Anda akan langsung aktif di:
   `https://tontonanku.github.io/BLK-Cafe/`

---

## 💻 Menjalankan di Komputer Lokal

Bisa dibuka langsung dengan berbagai cara:
1. **Langsung buka file**: Klik dua kali file `index.html` di browser Anda (Chrome/Edge/Firefox).
2. **Atau pakai server lokal**:
   ```bash
   # Jalankan via Node.js
   node server.js
   # Atau via npx serve
   npx serve .
   ```
   Buka `http://localhost:3000` di browser.

---

## 🔑 Akun Demo Admin
- **Email**: `admin@blokcafe.test`
- **Password**: `CafeAdmin123!`
*(Tersedia tombol "⚡ LOGIN ADMIN INSTAN" di modal login untuk masuk otomatis)*

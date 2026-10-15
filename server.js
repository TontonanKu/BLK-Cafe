require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { db, initDb } = require('./db');

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
}

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'blk-cafe-serverless-jwt-secret-key-2026';

let dbReady = false;
async function ensureDbReady() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
if (isVercel && fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

// Ensure database is initialized before handling API requests
app.use(async (req, res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database initialization error: ' + err.message });
  }
});

const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function signToken(user) {
  return jwt.sign(safeUser(user), JWT_SECRET, { expiresIn: '7d' });
}

// Authentication middleware using JWT
app.use((req, res, next) => {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Akses khusus admin.' });
  next();
}

function rupiah(n) {
  return new Intl.NumberFormat('id-ID').format(n);
}

async function calcVoucher(code, subtotal) {
  if (!code) return { discount: 0, voucher: null };
  const vRes = await db.execute({
    sql: 'SELECT * FROM vouchers WHERE UPPER(code)=UPPER(?) AND active=1',
    args: [String(code).trim()]
  });
  const v = vRes.rows[0];
  if (!v) throw new Error('Kode voucher tidak ditemukan atau sudah tidak aktif.');
  const now = new Date();
  if (v.starts_at && new Date(v.starts_at + 'T00:00:00') > now) throw new Error('Voucher belum mulai berlaku.');
  if (v.expires_at && new Date(v.expires_at + 'T23:59:59') < now) throw new Error('Voucher sudah kedaluwarsa.');
  if (v.usage_limit !== null && v.used_count >= v.usage_limit) throw new Error('Kuota voucher sudah habis.');
  if (subtotal < v.min_order) throw new Error(`Minimal belanja voucher Rp${rupiah(v.min_order)}.`);
  let discount = v.type === 'percent' ? Math.floor(subtotal * v.value / 100) : v.value;
  if (v.max_discount !== null) discount = Math.min(discount, v.max_discount);
  discount = Math.min(discount, subtotal);
  return { discount, voucher: v };
}

// Config & Auth Endpoints
app.get('/api/config', (req, res) => {
  res.json({
    cafeName: 'BLK CAFE',
    whatsapp: process.env.CAFE_WHATSAPP || '6281234567890',
    user: req.user ? safeUser(req.user) : null
  });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
  const cleanEmail = String(email).trim().toLowerCase();
  try {
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [cleanEmail] });
    if (existing.rows.length) return res.status(400).json({ error: 'Email sudah terdaftar.' });

    const hash = bcrypt.hashSync(password, 10);
    const r = await db.execute({
      sql: 'INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',
      args: [String(name).trim(), cleanEmail, hash]
    });
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id=?', args: [r.lastInsertRowid] });
    const user = userRes.rows[0];
    const token = signToken(user);
    res.cookie('token', token, cookieOpts);
    res.json({ user: safeUser(user) });
  } catch (e) {
    res.status(400).json({ error: 'Gagal membuat akun: ' + e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE email=?', args: [cleanEmail] });
  const user = userRes.rows[0];
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }
  const token = signToken(user);
  res.cookie('token', token, cookieOpts);
  res.json({ user: safeUser(user) });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user ? safeUser(req.user) : null });
});

// Catalog Endpoints
app.get('/api/menu', async (req, res) => {
  const { category, q } = req.query;
  let sql = 'SELECT * FROM menu_items WHERE available=1';
  const args = [];
  if (category && category !== 'Semua') {
    sql += ' AND category=?';
    args.push(category);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ? OR badge LIKE ?)';
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY id';
  const result = await db.execute({ sql, args });
  res.json(result.rows);
});

app.get('/api/promos', async (req, res) => {
  const result = await db.execute(`SELECT id,name,description,price,category,badge FROM menu_items WHERE available=1 AND badge<>'' ORDER BY id`);
  res.json(result.rows);
});

app.get('/api/vouchers', async (req, res) => {
  const result = await db.execute(`SELECT code,description,type,value,min_order,max_discount,expires_at FROM vouchers WHERE active=1 AND (expires_at IS NULL OR expires_at>=date('now'))`);
  res.json(result.rows);
});

app.post('/api/voucher/check', requireAuth, async (req, res) => {
  try {
    const { discount, voucher } = await calcVoucher(req.body.code, Number(req.body.subtotal) || 0);
    res.json({ discount, voucher: { code: voucher.code, description: voucher.description } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Order Management Endpoints
app.post('/api/orders', requireAuth, async (req, res) => {
  const { items, tableNumber = '', notes = '', phone = '', voucherCode = '' } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Keranjang masih kosong.' });
  const serviceType = 'Dine-in';
  const fulfillment = 'Kasir';
  const paymentMethod = 'Bayar di kasir';
  const cleanTable = String(tableNumber || '').trim();
  const cleanNotes = String(notes || '').trim();
  const combinedNotes = cleanTable ? `[MEJA ${cleanTable}] ${cleanNotes}`.trim() : cleanNotes;

  const normalized = [];
  let subtotal = 0;
  for (const item of items) {
    const mRes = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id=? AND available=1', args: [Number(item.id)] });
    const menu = mRes.rows[0];
    const qty = Math.max(1, Math.min(50, parseInt(item.quantity, 10) || 1));
    if (!menu) return res.status(400).json({ error: 'Ada menu yang sudah tidak tersedia. Muat ulang menu.' });
    normalized.push({ menu, qty, options: String(item.options || '').slice(0, 200) });
    subtotal += menu.price * qty;
  }

  let voucher = null, discount = 0;
  try {
    ({ voucher, discount } = await calcVoucher(voucherCode, subtotal));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const total = subtotal - discount;
  const code = 'BLK-' + Date.now().toString().slice(-7) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();

  const insertOrderRes = await db.execute({
    sql: `INSERT INTO orders (code,user_id,customer_name,phone,service_type,fulfillment,payment_method,notes,subtotal,discount,total,voucher_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [code, req.user.id, req.user.name, String(phone).slice(0, 30), serviceType, fulfillment, paymentMethod, combinedNotes.slice(0, 500), subtotal, discount, total, voucher ? voucher.code : null]
  });
  const orderId = insertOrderRes.lastInsertRowid;

  const itemStatements = normalized.map(x => ({
    sql: 'INSERT INTO order_items (order_id,menu_id,item_name,quantity,unit_price,options) VALUES (?,?,?,?,?,?)',
    args: [orderId, x.menu.id, x.menu.name, x.qty, x.menu.price, x.options]
  }));

  if (voucher) {
    itemStatements.push({
      sql: 'UPDATE vouchers SET used_count=used_count+1 WHERE id=?',
      args: [voucher.id]
    });
  }

  await db.batch(itemStatements, 'write');
  const order = await getOrder(orderId);
  res.status(201).json({ order });
});

async function getOrder(id) {
  const oRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] });
  const o = oRes.rows[0];
  if (!o) return null;
  const itemsRes = await db.execute({ sql: 'SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?', args: [id] });
  o.items = itemsRes.rows;
  return o;
}

app.get('/api/orders/mine', requireAuth, async (req, res) => {
  const oRes = await db.execute({ sql: 'SELECT * FROM orders WHERE user_id=? ORDER BY id DESC', args: [req.user.id] });
  const orders = oRes.rows;
  for (const o of orders) {
    const itemsRes = await db.execute({ sql: 'SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?', args: [o.id] });
    o.items = itemsRes.rows;
  }
  res.json(orders);
});

// Admin APIs
app.post('/api/admin/upload', requireAdmin, async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || typeof data !== 'string') return res.status(400).json({ error: 'Data gambar tidak valid.' });

    // Object Storage: Cloudinary upload
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const uploadRes = await cloudinary.uploader.upload(data, {
        folder: 'blk-cafe',
        resource_type: 'image'
      });
      return res.json({ url: uploadRes.secure_url });
    }

    // In serverless environment (Vercel) without Cloudinary: store data URI directly
    if (isVercel) {
      return res.json({ url: data });
    }

    // Local development fallback: store to public/uploads
    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer, ext = 'jpg';
    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else ext = 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }
    if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran foto maksimal 8MB.' });
    const cleanName = `menu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, cleanName);
    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/uploads/${cleanName}` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengunggah gambar: ' + err.message });
  }
});

app.get('/api/admin/summary', requireAdmin, async (req, res) => {
  const ordersRes = await db.execute('SELECT COUNT(*) n FROM orders');
  const pendingRes = await db.execute("SELECT COUNT(*) n FROM orders WHERE status='Menunggu Konfirmasi'");
  const revenueRes = await db.execute("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status<>'Dibatalkan'");
  const menuRes = await db.execute('SELECT COUNT(*) n FROM menu_items');
  res.json({
    orders: Number(ordersRes.rows[0].n),
    pending: Number(pendingRes.rows[0].n),
    revenue: Number(revenueRes.rows[0].n),
    menu: Number(menuRes.rows[0].n)
  });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const oRes = await db.execute('SELECT * FROM orders ORDER BY id DESC LIMIT 200');
  const orders = oRes.rows;
  for (const o of orders) {
    const itemsRes = await db.execute({ sql: 'SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?', args: [o.id] });
    o.items = itemsRes.rows;
  }
  res.json(orders);
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const allowed = ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Diproses', 'Siap Diambil', 'Selesai', 'Dibatalkan'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Status tidak valid.' });
  const result = await db.execute({
    sql: 'UPDATE orders SET status=? WHERE id=?',
    args: [req.body.status, Number(req.params.id)]
  });
  if (!result.rowsAffected) return res.status(404).json({ error: 'Order tidak ditemukan.' });
  res.json({ ok: true });
});

app.get('/api/admin/menu', requireAdmin, async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/api/admin/menu', requireAdmin, async (req, res) => {
  const { name, description = '', category = 'Makanan', price, image = '', badge = '' } = req.body || {};
  if (!name || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Nama dan harga menu wajib valid.' });
  const r = await db.execute({
    sql: 'INSERT INTO menu_items (name,description,category,price,image,badge) VALUES (?,?,?,?,?,?)',
    args: [String(name).slice(0, 100), String(description).slice(0, 300), String(category).slice(0, 40), Math.round(Number(price)), String(image).slice(0, 10000), String(badge).slice(0, 40)]
  });
  const created = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id=?', args: [r.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

app.patch('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  const oldRes = await db.execute({ sql: 'SELECT * FROM menu_items WHERE id=?', args: [Number(req.params.id)] });
  const old = oldRes.rows[0];
  if (!old) return res.status(404).json({ error: 'Menu tidak ditemukan.' });
  const b = req.body || {};
  await db.execute({
    sql: 'UPDATE menu_items SET name=?,description=?,category=?,price=?,image=?,badge=?,available=? WHERE id=?',
    args: [
      b.name ?? old.name,
      b.description ?? old.description,
      b.category ?? old.category,
      Number.isFinite(Number(b.price)) ? Math.max(0, Math.round(Number(b.price))) : old.price,
      b.image ?? old.image,
      b.badge ?? old.badge,
      b.available === undefined ? old.available : (b.available ? 1 : 0),
      old.id
    ]
  });
  res.json({ ok: true });
});

app.delete('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  const r = await db.execute({ sql: 'UPDATE menu_items SET available=0 WHERE id=?', args: [Number(req.params.id)] });
  res.json({ ok: !!r.rowsAffected });
});

app.get('/api/admin/vouchers', requireAdmin, async (req, res) => {
  const result = await db.execute('SELECT * FROM vouchers ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/api/admin/vouchers', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.code || !Number(b.value) || !['percent', 'fixed'].includes(b.type)) return res.status(400).json({ error: 'Kode, tipe, dan nilai voucher wajib diisi.' });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at,active) VALUES (?,?,?,?,?,?,?,?,1)',
      args: [
        String(b.code).toUpperCase().slice(0, 30),
        String(b.description || '').slice(0, 200),
        b.type,
        Number(b.value),
        Number(b.min_order) || 0,
        b.max_discount === '' || b.max_discount == null ? null : Number(b.max_discount),
        b.usage_limit === '' || b.usage_limit == null ? null : Number(b.usage_limit),
        b.expires_at || null
      ]
    });
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Kode voucher sudah digunakan atau data tidak valid.' });
  }
});

app.patch('/api/admin/vouchers/:id', requireAdmin, async (req, res) => {
  await db.execute({
    sql: 'UPDATE vouchers SET active=? WHERE id=?',
    args: [req.body.active ? 1 : 0, Number(req.params.id)]
  });
  res.json({ ok: true });
});

// Single Page Application Fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (!isVercel) {
  app.listen(PORT, () => console.log(`BLK CAFE running at http://localhost:${PORT}`));
}

module.exports = app;

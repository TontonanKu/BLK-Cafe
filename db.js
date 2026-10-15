require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const bcrypt = require('bcryptjs');

const isVercel = Boolean(process.env.VERCEL);
const url = process.env.TURSO_DATABASE_URL || 
  (isVercel ? 'file:/tmp/cafe.sqlite' : `file:${path.join(__dirname, 'cafe.sqlite')}`);
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({
  url,
  authToken
});

async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', category TEXT NOT NULL,
      price INTEGER NOT NULL, image TEXT DEFAULT '', badge TEXT DEFAULT '', available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, description TEXT DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('percent','fixed')), value INTEGER NOT NULL, min_order INTEGER NOT NULL DEFAULT 0,
      max_discount INTEGER, usage_limit INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT, expires_at TEXT, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL, phone TEXT DEFAULT '', service_type TEXT NOT NULL,
      fulfillment TEXT NOT NULL, payment_method TEXT NOT NULL, notes TEXT DEFAULT '',
      subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      voucher_code TEXT, status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, menu_id INTEGER,
      item_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, options TEXT DEFAULT '',
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Check seeds
  const countRes = await db.execute('SELECT COUNT(*) AS n FROM menu_items');
  const count = Number(countRes.rows[0].n);
  if (!count) {
    const seeds = [
      ['BLK Smash Burger','Double beef, cheddar, house sauce, potato bun.','Makanan',38000,'','BEST SELLER'],
      ['Crispy Chicken Burger','Ayam crispy, slaw segar, saus mayo pedas.','Makanan',30000,'','FAVORIT'],
      ['Loaded Fries','Kentang renyah, cheese sauce, smoked beef.','Snack',22000,'',''],
      ['Chicken Rice Bowl','Nasi hangat, ayam crispy, sambal matah.','Makanan',28000,'',''],
      ['Iced Americano','Espresso dengan es dan air mineral.','Minuman',18000,'',''],
      ['Brown Sugar Latte','Espresso, susu, dan brown sugar.','Minuman',25000,'','NEW'],
      ['Matcha Cloud','Matcha creamy dengan foam lembut.','Minuman',27000,'',''],
      ['Choco Fudge Cake','Cake cokelat pekat, cocok buat sharing.','Dessert',24000,'','']
    ];
    for (const s of seeds) {
      await db.execute({
        sql: 'INSERT INTO menu_items (name, description, category, price, image, badge) VALUES (?,?,?,?,?,?)',
        args: s
      });
    }
  }

  const vCheck = await db.execute({ sql: 'SELECT id FROM vouchers WHERE code=?', args: ['KENALAN'] });
  if (!vCheck.rows.length) {
    await db.execute({
      sql: `INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at) VALUES (?,?,?,?,?,?,?,?)`,
      args: ['KENALAN','Diskon 20% untuk pelanggan baru','percent',20,50000,15000,100,'2027-12-31']
    });
    await db.execute({
      sql: `INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at) VALUES (?,?,?,?,?,?,?,?)`,
      args: ['HEMAT10','Potongan Rp10.000 min. belanja Rp75.000','fixed',10000,75000,null,200,'2027-12-31']
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@blokcafe.test';
  const adminPassword = process.env.ADMIN_PASSWORD || 'CafeAdmin123!';
  const aCheck = await db.execute({ sql: 'SELECT id FROM users WHERE email=?', args: [adminEmail] });
  if (!aCheck.rows.length) {
    await db.execute({
      sql: 'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      args: ['Admin BLK Cafe', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin']
    });
  }
}

module.exports = { db, initDb };

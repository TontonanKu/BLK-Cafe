require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'cafe.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
 db.exec(`
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

const seedCount = db.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n;
if (!seedCount) {
 const insert = db.prepare('INSERT INTO menu_items (name, description, category, price, image, badge) VALUES (?,?,?,?,?,?)');
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
 const tx = db.transaction(() => seeds.forEach(s => insert.run(...s)));
 tx();
}
if (!db.prepare('SELECT id FROM vouchers WHERE code=?').get('KENALAN')) {
 db.prepare(`INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run('KENALAN','Diskon 20% untuk pelanggan baru','percent',20,50000,15000,100,'2027-12-31');
 db.prepare(`INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run('HEMAT10','Potongan Rp10.000 min. belanja Rp75.000','fixed',10000,75000,null,200,'2027-12-31');
}
const adminEmail = process.env.ADMIN_EMAIL || 'admin@blokcafe.test';
const adminPassword = process.env.ADMIN_PASSWORD || 'CafeAdmin123!';
if (!db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail)) {
 db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run('Admin BLK Cafe', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-change-this-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000*60*60*24*7 } }));
app.use(express.static(path.join(__dirname, 'public')));

const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role });
function auth(req,res,next){ if(!req.session.user) return res.status(401).json({error:'Silakan login terlebih dahulu.'}); next(); }
function admin(req,res,next){ if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({error:'Akses khusus admin.'}); next(); }
function rupiah(n){ return new Intl.NumberFormat('id-ID').format(n); }
function calcVoucher(code, subtotal){
 if(!code) return {discount:0,voucher:null};
 const v = db.prepare('SELECT * FROM vouchers WHERE UPPER(code)=UPPER(?) AND active=1').get(String(code).trim());
 if(!v) throw new Error('Kode voucher tidak ditemukan atau sudah tidak aktif.');
 const now = new Date();
 if(v.starts_at && new Date(v.starts_at+'T00:00:00') > now) throw new Error('Voucher belum mulai berlaku.');
 if(v.expires_at && new Date(v.expires_at+'T23:59:59') < now) throw new Error('Voucher sudah kedaluwarsa.');
 if(v.usage_limit !== null && v.used_count >= v.usage_limit) throw new Error('Kuota voucher sudah habis.');
 if(subtotal < v.min_order) throw new Error(`Minimal belanja voucher Rp${rupiah(v.min_order)}.`);
 let discount = v.type==='percent' ? Math.floor(subtotal*v.value/100) : v.value;
 if(v.max_discount !== null) discount = Math.min(discount,v.max_discount);
 discount = Math.min(discount,subtotal);
 return {discount,voucher:v};
}

app.get('/api/config',(req,res)=>res.json({cafeName:'BLK CAFE',whatsapp:process.env.CAFE_WHATSAPP||'6281234567890',user:req.session.user?safeUser(req.session.user):null}));
app.post('/api/register',(req,res)=>{
 const {name,email,password}=req.body||{};
 if(!name||!email||!password) return res.status(400).json({error:'Nama, email, dan password wajib diisi.'});
 if(String(password).length<8) return res.status(400).json({error:'Password minimal 8 karakter.'});
 try { const result=db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(String(name).trim(),String(email).trim().toLowerCase(),bcrypt.hashSync(password,10));
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid); req.session.user=safeUser(user); res.json({user:safeUser(user)});
 } catch(e){res.status(400).json({error:e.code==='SQLITE_CONSTRAINT_UNIQUE'?'Email sudah terdaftar.':'Gagal membuat akun.'});}
});
app.post('/api/login',(req,res)=>{const {email,password}=req.body||{};const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());if(!user||!bcrypt.compareSync(String(password||''),user.password_hash))return res.status(401).json({error:'Email atau password salah.'});req.session.user=safeUser(user);res.json({user:safeUser(user)});});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));
app.get('/api/menu',(req,res)=>{const {category,q}=req.query;let sql='SELECT * FROM menu_items WHERE available=1';const args=[];if(category&&category!=='Semua'){sql+=' AND category=?';args.push(category);}if(q){sql+=' AND (name LIKE ? OR description LIKE ?)';args.push('%'+q+'%','%'+q+'%');}sql+=' ORDER BY id';res.json(db.prepare(sql).all(...args));});
app.get('/api/promos',(req,res)=>res.json(db.prepare('SELECT id,name,description,price,category,badge FROM menu_items WHERE available=1 AND badge<>\'\' ORDER BY id').all()));
app.get('/api/vouchers',(req,res)=>res.json(db.prepare(`SELECT code,description,type,value,min_order,max_discount,expires_at FROM vouchers WHERE active=1 AND (expires_at IS NULL OR expires_at>=date('now'))`).all()));
app.post('/api/voucher/check',auth,(req,res)=>{try{const {discount,voucher}=calcVoucher(req.body.code,Number(req.body.subtotal)||0);res.json({discount,voucher:{code:voucher.code,description:voucher.description}});}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/orders',auth,(req,res)=>{
 const {items,tableNumber='',notes='',phone='',voucherCode=''}=req.body||{};
 if(!Array.isArray(items)||!items.length) return res.status(400).json({error:'Keranjang masih kosong.'});
 const serviceType='Dine-in';
 const fulfillment='Kasir';
 const paymentMethod='Bayar di kasir';
 const cleanTable=String(tableNumber||'').trim();
 const cleanNotes=String(notes||'').trim();
 const combinedNotes=cleanTable?`[MEJA ${cleanTable}] ${cleanNotes}`.trim():cleanNotes;
 const normalized=[];let subtotal=0;
 for(const item of items){const menu=db.prepare('SELECT * FROM menu_items WHERE id=? AND available=1').get(Number(item.id));const qty=Math.max(1,Math.min(50,parseInt(item.quantity,10)||1));if(!menu)return res.status(400).json({error:'Ada menu yang sudah tidak tersedia. Muat ulang menu.'});normalized.push({menu,qty,options:String(item.options||'').slice(0,200)});subtotal+=menu.price*qty;}
 let voucher=null,discount=0;try{({voucher,discount}=calcVoucher(voucherCode,subtotal));}catch(e){return res.status(400).json({error:e.message});}
 const total=subtotal-discount;const code='BLK-'+Date.now().toString().slice(-7)+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
 const tx=db.transaction(()=>{const result=db.prepare(`INSERT INTO orders (code,user_id,customer_name,phone,service_type,fulfillment,payment_method,notes,subtotal,discount,total,voucher_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(code,req.session.user.id,req.session.user.name,String(phone).slice(0,30),serviceType,fulfillment,paymentMethod,combinedNotes.slice(0,500),subtotal,discount,total,voucher?voucher.code:null);const orderId=result.lastInsertRowid;const insert=db.prepare('INSERT INTO order_items (order_id,menu_id,item_name,quantity,unit_price,options) VALUES (?,?,?,?,?,?)');normalized.forEach(x=>insert.run(orderId,x.menu.id,x.menu.name,x.qty,x.menu.price,x.options));if(voucher)db.prepare('UPDATE vouchers SET used_count=used_count+1 WHERE id=?').run(voucher.id);return orderId;});
 const id=tx();const order=getOrder(id);res.status(201).json({order});
});
function getOrder(id){const o=db.prepare('SELECT * FROM orders WHERE id=?').get(id);if(!o)return null;o.items=db.prepare('SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?').all(id);return o;}
app.get('/api/orders/mine',auth,(req,res)=>{const orders=db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.session.user.id);orders.forEach(o=>o.items=db.prepare('SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?').all(o.id));res.json(orders);});
// Admin APIs
app.post('/api/admin/upload',admin,(req,res)=>{
 try{
  const {data}=req.body||{};
  if(!data||typeof data!=='string') return res.status(400).json({error:'Data gambar tidak valid.'});
  const matches=data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let buffer,ext='jpg';
  if(matches&&matches.length===3){
   const mime=matches[1];
   if(mime.includes('png')) ext='png';
   else if(mime.includes('webp')) ext='webp';
   else if(mime.includes('gif')) ext='gif';
   else ext='jpg';
   buffer=Buffer.from(matches[2],'base64');
  }else{
   buffer=Buffer.from(data,'base64');
  }
  if(buffer.length>8*1024*1024) return res.status(400).json({error:'Ukuran foto maksimal 8MB.'});
  const cleanName=`menu-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
  const filePath=path.join(uploadsDir,cleanName);
  fs.writeFileSync(filePath,buffer);
  res.json({url:`/uploads/${cleanName}`});
 }catch(err){res.status(500).json({error:'Gagal mengunggah gambar: '+err.message});}
});
app.get('/api/admin/summary',admin,(req,res)=>{res.json({orders:db.prepare('SELECT COUNT(*) n FROM orders').get().n,pending:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='Menunggu Konfirmasi'").get().n,revenue:db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status<>'Dibatalkan'").get().n,menu:db.prepare('SELECT COUNT(*) n FROM menu_items').get().n});});
app.get('/api/admin/orders',admin,(req,res)=>{const orders=db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();orders.forEach(o=>o.items=db.prepare('SELECT item_name,quantity,unit_price,options FROM order_items WHERE order_id=?').all(o.id));res.json(orders);});
app.patch('/api/admin/orders/:id',admin,(req,res)=>{const allowed=['Menunggu Konfirmasi','Dikonfirmasi','Diproses','Siap Diambil','Selesai','Dibatalkan'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Status tidak valid.'});const result=db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,Number(req.params.id));if(!result.changes)return res.status(404).json({error:'Order tidak ditemukan.'});res.json({ok:true});});
app.get('/api/admin/menu',admin,(req,res)=>res.json(db.prepare('SELECT * FROM menu_items ORDER BY id DESC').all()));
app.post('/api/admin/menu',admin,(req,res)=>{const {name,description='',category='Makanan',price,image='',badge=''}=req.body||{};if(!name||!Number.isFinite(Number(price))||Number(price)<0)return res.status(400).json({error:'Nama dan harga menu wajib valid.'});const r=db.prepare('INSERT INTO menu_items (name,description,category,price,image,badge) VALUES (?,?,?,?,?,?)').run(String(name).slice(0,100),String(description).slice(0,300),String(category).slice(0,40),Math.round(Number(price)),String(image).slice(0,500),String(badge).slice(0,40));res.status(201).json(db.prepare('SELECT * FROM menu_items WHERE id=?').get(r.lastInsertRowid));});
app.patch('/api/admin/menu/:id',admin,(req,res)=>{const old=db.prepare('SELECT * FROM menu_items WHERE id=?').get(Number(req.params.id));if(!old)return res.status(404).json({error:'Menu tidak ditemukan.'});const b=req.body||{};db.prepare('UPDATE menu_items SET name=?,description=?,category=?,price=?,image=?,badge=?,available=? WHERE id=?').run(b.name??old.name,b.description??old.description,b.category??old.category,Number.isFinite(Number(b.price))?Math.max(0,Math.round(Number(b.price))):old.price,b.image??old.image,b.badge??old.badge,b.available===undefined?old.available:(b.available?1:0),old.id);res.json({ok:true});});
app.delete('/api/admin/menu/:id',admin,(req,res)=>{const r=db.prepare('UPDATE menu_items SET available=0 WHERE id=?').run(Number(req.params.id));res.json({ok:!!r.changes});});
app.get('/api/admin/vouchers',admin,(req,res)=>res.json(db.prepare('SELECT * FROM vouchers ORDER BY id DESC').all()));
app.post('/api/admin/vouchers',admin,(req,res)=>{const b=req.body||{};if(!b.code||!Number(b.value)||!['percent','fixed'].includes(b.type))return res.status(400).json({error:'Kode, tipe, dan nilai voucher wajib diisi.'});try{const r=db.prepare('INSERT INTO vouchers (code,description,type,value,min_order,max_discount,usage_limit,expires_at,active) VALUES (?,?,?,?,?,?,?,?,1)').run(String(b.code).toUpperCase().slice(0,30),String(b.description||'').slice(0,200),b.type,Number(b.value),Number(b.min_order)||0,b.max_discount===''||b.max_discount==null?null:Number(b.max_discount),b.usage_limit===''||b.usage_limit==null?null:Number(b.usage_limit),b.expires_at||null);res.status(201).json({id:r.lastInsertRowid});}catch(e){res.status(400).json({error:'Kode voucher sudah digunakan atau data tidak valid.'});}});
app.patch('/api/admin/vouchers/:id',admin,(req,res)=>{db.prepare('UPDATE vouchers SET active=? WHERE id=?').run(req.body.active?1:0,Number(req.params.id));res.json({ok:true});});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`BLK CAFE running at http://localhost:${PORT}`));

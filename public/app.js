const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const state = {
  user: null,
  menu: [],
  adminMenuItems: [],
  category: 'Semua',
  query: '',
  cart: [],
  voucherCode: '',
  discount: 0,
  voucherDescription: '',
  lastOrder: null,
  authMode: 'login',
  adminTab: 'orders',
  viewMode: 'storefront',
  orderFilter: 'Semua',
  tableNumber: '',
  soundEnabled: localStorage.getItem('blk_sound_enabled') !== '0',
  previousPendingCount: null,
  adminOrders: [],
  tablePresets: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'Bar 01', 'Bar 02']
};

const imageMap = {
  'BLK Smash Burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
  'Crispy Chicken Burger': 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=700&q=80',
  'Loaded Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80',
  'Chicken Rice Bowl': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80',
  'Iced Americano': 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=700&q=80',
  'Brown Sugar Latte': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80',
  'Matcha Cloud': 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=700&q=80',
  'Choco Fudge Cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80'
};

async function api(url, options={}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan. Coba lagi.');
  return data;
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}

function setViewMode(mode) {
  state.viewMode = mode;
  const isStaff = state.user && state.user.role === 'admin';
  const storefront = $('#storefrontView');
  const adminPanel = $('#adminPanelView');
  const adminBanner = $('#adminBanner');

  if (isStaff && mode === 'admin') {
    if (storefront) storefront.classList.add('hidden');
    if (adminPanel) adminPanel.classList.remove('hidden');
    if (adminBanner) adminBanner.classList.add('hidden');
    closePanels();
    updateSoundButton();
    renderAdmin();
    startAdminPolling();
  } else {
    stopAdminPolling();
    if (storefront) storefront.classList.remove('hidden');
    if (adminPanel) adminPanel.classList.add('hidden');
    if (isStaff && mode === 'storefront') {
      if (adminBanner) adminBanner.classList.remove('hidden');
    } else {
      if (adminBanner) adminBanner.classList.add('hidden');
    }
  }
}

function setUser(user) {
  state.user = user;
  const label = $('#accountLabel');
  const btn = $('#accountBtn');
  if (label) label.textContent = user ? (user.role === 'admin' ? 'ADMIN' : 'ACCOUNT') : 'LOGIN';
  if (btn) btn.title = user ? `Akun: ${user.name}` : 'Login';

  if (user && user.role === 'admin') {
    setViewMode('admin');
  } else {
    setViewMode('storefront');
  }
}

function showModal(id) {
  closePanels();
  const el = $('#' + id);
  if (el) el.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePanels() {
  $$('.modal-wrap.show').forEach(x => x.classList.remove('show'));
  const cart = $('#cartDrawer');
  const overlay = $('#overlay');
  if (cart) cart.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

function openCart() {
  closePanels();
  const cart = $('#cartDrawer');
  const overlay = $('#overlay');
  if (cart) cart.classList.add('open');
  if (overlay) overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  renderCart();
}

function fmtShort(n) {
  return money(n).replace(',00', '');
}

function getBadgeClass(badge = '') {
  const b = String(badge).toLowerCase();
  if (b.includes('pedas') || b.includes('spicy') || b.includes('🌶')) return 'badge-pedas';
  if (b.includes('best') || b.includes('favorit') || b.includes('rekomendasi') || b.includes('⭐') || b.includes('🔥')) return 'badge-bestseller';
  if (b.includes('dingin') || b.includes('ice') || b.includes('cold') || b.includes('🧊')) return 'badge-dingin';
  if (b.includes('kopi') || b.includes('coffee') || b.includes('espresso') || b.includes('☕')) return 'badge-kopi';
  if (b.includes('veggie') || b.includes('fresh') || b.includes('salad') || b.includes('🌱')) return 'badge-veggie';
  return '';
}

function foodImage(item, index) {
  const url = item.image || imageMap[item.name];
  const badgeClass = item.badge ? getBadgeClass(item.badge) : '';
  return `<div class="food-image">${item.badge ? `<span class="menu-badge ${badgeClass}">${escapeHtml(item.badge)}</span>` : ''}${url ? `<img loading="lazy" src="${escapeAttr(url)}" alt="${escapeAttr(item.name)}" onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','<div class=\\'food-placeholder\\'><span>${escapeHtml(item.name.split(' ').map(w=>w[0]).join('').slice(0,3))}</span></div>')">` : `<div class="food-placeholder"><span>${escapeHtml(item.name.split(' ').map(w=>w[0]).join('').slice(0,3))}</span></div>`}</div>`;
}

function escapeHtml(str='') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str='') {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function extractTable(notes = '') {
  const match = String(notes).match(/\[MEJA\s+([^\]]+)\]/i);
  return match ? match[1].trim() : '-';
}

function renderTableBanner() {
  const el = $('#tableNotice');
  if (!el) return;
  if (!state.tableNumber) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="table-notice-inner">
      <div class="table-notice-left">
        <span class="table-badge-tag">📍 MEJA AKTIF</span>
        <span>Pesanan makan di tempat otomatis untuk: <b class="table-num-highlight">Meja ${escapeHtml(state.tableNumber)}</b></span>
      </div>
      <div class="table-notice-actions">
        <button class="btn-xs-clean" id="changeTableBtn">Ganti Meja</button>
        <button class="btn-xs-close" id="dismissTableBtn" title="Tutup pemberitahuan">✕</button>
      </div>
    </div>
  `;
}

let audioCtx = null;
function playOrderBell() {
  if (!state.soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    // First Tone: E5 (659.25 Hz) - warm bell strike
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.7);

    // Second Tone: A5 (880 Hz) - crystalline harmonic resonance
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    gain2.gain.setValueAtTime(0.38, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 1.2);
  } catch (err) {
    console.warn('Audio alert error:', err);
  }
}

function updateSoundButton() {
  const btn = $('#soundToggleBtn');
  const label = $('#soundToggleLabel');
  if (!btn || !label) return;
  if (state.soundEnabled) {
    btn.classList.remove('muted');
    btn.title = 'Bel suara pesanan aktif (Klik untuk membisukan)';
    label.textContent = 'BEL: ON';
  } else {
    btn.classList.add('muted');
    btn.title = 'Bel suara pesanan bisu (Klik untuk mengaktifkan)';
    label.textContent = 'BEL: OFF';
  }
}

let adminPollTimer = null;
function startAdminPolling() {
  stopAdminPolling();
  adminPollTimer = setInterval(async () => {
    if (state.viewMode !== 'admin' || !state.user || state.user.role !== 'admin') {
      stopAdminPolling();
      return;
    }
    try {
      const summary = await api('/api/admin/summary');
      if (typeof state.previousPendingCount === 'number' && summary.pending > state.previousPendingCount) {
        playOrderBell();
        toast(`🔔 PESANAN BARU MASUK! Total ${summary.pending} pesanan menunggu.`);
        if (state.adminTab === 'orders') {
          renderAdmin();
        }
      }
      state.previousPendingCount = summary.pending;
    } catch {}
  }, 12000);
}

function stopAdminPolling() {
  if (adminPollTimer) {
    clearInterval(adminPollTimer);
    adminPollTimer = null;
  }
}

function printReceipt(orderId) {
  const order = (state.adminOrders || []).find(o => o.id === Number(orderId));
  if (!order) {
    toast('Data pesanan tidak ditemukan.');
    return;
  }
  const tableNo = extractTable(order.notes);
  const dateStr = new Date(order.created_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const cashierName = (state.user && state.user.name) || 'Kasir BLK';
  const cleanNotes = (order.notes || '').replace(/\[MEJA\s+[^\]]+\]/i, '').trim();

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="text-align:left;padding:3px 0;vertical-align:top">
        <b>${escapeHtml(item.item_name)}</b>${item.options ? `<br><small style="font-size:10px;color:#555">(${escapeHtml(item.options)})</small>` : ''}
      </td>
      <td style="text-align:center;padding:3px 4px;vertical-align:top">${item.quantity}</td>
      <td style="text-align:right;padding:3px 0;vertical-align:top">${fmtShort(item.unit_price * item.quantity)}</td>
    </tr>
  `).join('');

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Struk Order - ${escapeHtml(order.code)}</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 14px 12px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.35;
          color: #000;
          background: #fff;
          max-width: 300px;
          margin-inline: auto;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .brand-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
        .brand-sub { font-size: 10px; margin-top: 2px; }
        .divider-double { border-top: 2px dashed #000; margin: 8px 0; }
        .divider-single { border-top: 1px dashed #000; margin: 6px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; }
        .total-row { font-size: 14px; font-weight: 900; margin-top: 4px; display: flex; justify-content: space-between; }
        .footer { text-align: center; font-size: 10.5px; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="brand-title">BLK CAFE</div>
        <div class="brand-sub">GOOD FOOD. NO SMALL TALK.</div>
        <div class="brand-sub">Jl. Kopi No. 08, Kota Kamu · WA: 0812-3456-7890</div>
      </div>
      <div class="divider-double"></div>
      <div class="info-row"><span>NO ORDER</span><b>${escapeHtml(order.code)}</b></div>
      <div class="info-row"><span>TANGGAL</span><span>${escapeHtml(dateStr)}</span></div>
      <div class="info-row"><span>MEJA</span><b>MEJA ${escapeHtml(tableNo)}</b></div>
      <div class="info-row"><span>PELANGGAN</span><span>${escapeHtml(order.customer_name)}</span></div>
      ${order.phone ? `<div class="info-row"><span>TELP</span><span>${escapeHtml(order.phone)}</span></div>` : ''}
      <div class="info-row"><span>KASIR</span><span>${escapeHtml(cashierName)}</span></div>
      <div class="info-row"><span>LAYANAN</span><b>DINE-IN (BAYAR KASIR)</b></div>
      <div class="divider-single"></div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left">ITEM</th>
            <th style="text-align:center;width:30px">QTY</th>
            <th style="text-align:right;width:75px">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="divider-single"></div>
      <div class="info-row"><span>SUBTOTAL</span><span>${fmtShort(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="info-row"><span>DISKON (${escapeHtml(order.voucher_code || 'VOUCHER')})</span><span>−${fmtShort(order.discount)}</span></div>` : ''}
      <div class="divider-double"></div>
      <div class="total-row"><span>TOTAL AKHIR</span><span>${fmtShort(order.total)}</span></div>
      <div class="divider-double"></div>
      <div class="info-row"><span>STATUS</span><b>${escapeHtml(order.status.toUpperCase())}</b></div>
      ${cleanNotes ? `<div style="font-size:10px;margin-top:4px"><b>Catatan:</b> ${escapeHtml(cleanNotes)}</div>` : ''}
      <div class="footer">
        <p style="margin:4px 0">=== TERIMA KASIH ===<br>Selamat Menikmati Hidangan Kami!</p>
        <p style="margin:4px 0;font-size:9.5px;color:#333">Wifi: BLK-CAFE / Sandi: goodfood123</p>
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(receiptHtml);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2500);
  }, 250);
}

function printTableTentCard(tableNo) {
  const url = `${window.location.origin}/?table=${encodeURIComponent(tableNo)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  const tentHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>QR Stand Meja ${escapeHtml(tableNo)} - BLK CAFE</title>
      <style>
        @page { size: auto; margin: 15mm; }
        body {
          font-family: 'DM Sans', sans-serif;
          text-align: center;
          margin: 0;
          padding: 20px;
          background: #fff;
          color: #151515;
        }
        .tent-card {
          width: 320px;
          border: 4px solid #151515;
          margin: 20px auto;
          padding: 28px 24px;
          box-shadow: 8px 8px 0 #151515;
          background: #fffefa;
        }
        .brand-title {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 1px;
          font-family: 'Barlow Condensed', sans-serif;
          margin: 0;
        }
        .brand-sub {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          margin-top: 4px;
          color: #555;
        }
        .table-box {
          background: #ffd52a;
          border: 3px solid #151515;
          padding: 8px 16px;
          margin: 18px 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 42px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .qr-img {
          width: 200px;
          height: 200px;
          border: 3px solid #151515;
          padding: 8px;
          background: white;
          display: block;
          margin: 0 auto;
        }
        .scan-instruct {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
          margin-top: 14px;
        }
        .step-list {
          font-size: 10px;
          color: #444;
          margin: 10px 0 0;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="tent-card">
        <div class="brand-title">BLK CAFE</div>
        <div class="brand-sub">GOOD FOOD. NO SMALL TALK.</div>
        <div class="table-box">MEJA ${escapeHtml(tableNo)}</div>
        <img class="qr-img" src="${qrUrl}" alt="QR Meja ${escapeHtml(tableNo)}">
        <div class="scan-instruct">SCAN UNTUK PESAN LANGSUNG ↗</div>
        <div class="step-list">
          1. Arahkan kamera HP ke QR Code<br>
          2. Pilih menu favoritmu di web<br>
          3. Bayar di kasir, hidangan diantar ke meja
        </div>
      </div>
    </body>
    </html>
  `;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(tentHtml);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2500);
  }, 300);
}

function printAllTableStickers() {
  const tables = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  const cardsHtml = tables.map(t => {
    const url = `${window.location.origin}/?table=${encodeURIComponent(t)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
    return `
      <div class="sticker-card">
        <div class="sticker-brand">BLK CAFE</div>
        <div class="sticker-table">MEJA ${t}</div>
        <img class="sticker-qr" src="${qrUrl}" alt="QR Meja ${t}">
        <div class="sticker-foot">SCAN & PESAN ↗</div>
      </div>
    `;
  }).join('');

  const sheetHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Stiker QR Meja 01-10 - BLK CAFE</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; margin: 0; padding: 10px; }
        .sheet-title { text-align: center; font-size: 16px; font-weight: 900; margin-bottom: 12px; }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .sticker-card {
          border: 2.5px solid #151515;
          padding: 12px;
          text-align: center;
          background: #fffefa;
        }
        .sticker-brand { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 900; }
        .sticker-table {
          background: #ffd52a;
          border: 1.5px solid #151515;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 26px;
          font-weight: 900;
          margin: 6px auto;
          padding: 3px 10px;
          width: max-content;
        }
        .sticker-qr { width: 110px; height: 110px; border: 1.5px solid #151515; padding: 4px; display: block; margin: 0 auto; }
        .sticker-foot { font-size: 9px; font-weight: 900; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="sheet-title">BLK CAFE — LEMBAR STIKER QR MEJA (01 S/D 10)</div>
      <div class="grid">
        ${cardsHtml}
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(sheetHtml);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 2500);
  }, 300);
}

async function loadMenu() {
  try {
    state.menu = await api('/api/menu');
    renderMenu();
  } catch (e) {
    const grid = $('#menu-grid');
    if (grid) grid.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}

function renderMenu() {
  const grid = $('#menu-grid');
  if (!grid) return;
  const filtered = state.menu.filter(m => (state.category === 'Semua' || m.category === state.category) && (!state.query || `${m.name} ${m.description} ${m.badge || ''}`.toLowerCase().includes(state.query.toLowerCase())));
  grid.innerHTML = filtered.length ? filtered.map((m, i) => `
    <article class="menu-card">
      ${foodImage(m, i)}
      <div class="menu-card-body">
        <div class="menu-category">${escapeHtml(m.category.toUpperCase())}</div>
        <h3>${escapeHtml(m.name)}</h3>
        <p>${escapeHtml(m.description || 'Freshly made, just for you.')}</p>
        <div class="menu-card-foot">
          <span class="menu-price">${fmtShort(m.price)}</span>
          <button class="add-btn" data-add="${m.id}" aria-label="Tambah ${escapeAttr(m.name)}">+</button>
        </div>
      </div>
    </article>
  `).join('') : '<div class="empty-state">NO MATCHES. COBA KATA KUNCI LAIN.</div>';
}

function addToCart(id) {
  const m = state.menu.find(x => x.id === Number(id));
  if (!m) return;
  const found = state.cart.find(x => x.id === m.id);
  if (found) found.quantity = Math.min(50, found.quantity + 1);
  else state.cart.push({ id: m.id, name: m.name, price: m.price, quantity: 1, options: '' });
  if (state.voucherCode) {
    state.discount = 0;
    state.voucherCode = '';
    state.voucherDescription = '';
  }
  renderCart();
  toast(`${m.name} ditambahkan ke bag.`);
}

function subtotal() {
  return state.cart.reduce((s, x) => s + x.price * x.quantity, 0);
}

function renderCart() {
  const count = state.cart.reduce((s, x) => s + x.quantity, 0);
  const countEl = $('#cartCount');
  if (countEl) countEl.textContent = count;
  const itemsEl = $('#cartItems');
  if (itemsEl) {
    itemsEl.innerHTML = state.cart.length ? state.cart.map(x => `
      <div class="cart-row">
        <div>
          <h4>${escapeHtml(x.name)}</h4>
          <p>${fmtShort(x.price)} / item</p>
        </div>
        <div class="cart-row-right">
          <strong>${fmtShort(x.price * x.quantity)}</strong>
          <div class="qty-control">
            <button data-qty="${x.id}" data-delta="-1">−</button>
            <b>${x.quantity}</b>
            <button data-qty="${x.id}" data-delta="1">+</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="empty-state">YOUR BAG IS EMPTY.<br>LET’S FIX THAT.</div>';
  }
  const subEl = $('#cartSubtotal');
  if (subEl) subEl.textContent = fmtShort(subtotal());
  const discEl = $('#cartDiscount');
  if (discEl) discEl.textContent = '−' + fmtShort(state.discount);
  const totEl = $('#cartTotal');
  if (totEl) totEl.textContent = fmtShort(Math.max(0, subtotal() - state.discount));
  const vInput = $('#cartVoucher');
  if (vInput) vInput.value = state.voucherCode;
  const vMsg = $('#voucherMessage');
  if (vMsg) vMsg.textContent = state.voucherDescription;
  const chkBtn = $('#checkoutBtn');
  if (chkBtn) {
    chkBtn.disabled = !state.cart.length;
    chkBtn.style.opacity = state.cart.length ? '1' : '.5';
  }
}

async function applyVoucher() {
  if (!state.user) {
    openAuth('login');
    toast('Login dulu untuk pakai voucher.');
    return;
  }
  const input = $('#cartVoucher');
  const code = input ? input.value.trim() : '';
  if (!code) {
    state.voucherCode = '';
    state.discount = 0;
    state.voucherDescription = '';
    renderCart();
    return;
  }
  try {
    const result = await api('/api/voucher/check', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal: subtotal() })
    });
    state.voucherCode = result.voucher.code;
    state.discount = result.discount;
    state.voucherDescription = `${result.voucher.code} applied — hemat ${fmtShort(result.discount)}.`;
    renderCart();
    toast('Voucher berhasil dipakai!');
  } catch (e) {
    state.voucherCode = '';
    state.discount = 0;
    state.voucherDescription = e.message;
    renderCart();
    const vMsg = $('#voucherMessage');
    if (vMsg) vMsg.style.color = '#b3261e';
  }
}

async function loadVouchers() {
  try {
    const vouchers = await api('/api/vouchers');
    const grid = $('#voucherGrid');
    if (!grid) return;
    grid.innerHTML = vouchers.length ? vouchers.map(v => {
      const value = v.type === 'percent' ? `${v.value}%` : `${Math.round(v.value / 1000)}K`;
      return `
        <article class="voucher-card">
          <div class="voucher-info">
            <div class="voucher-code">${escapeHtml(v.code)}</div>
            <p>${escapeHtml(v.description || 'A little something for you.')}</p>
            <div class="voucher-terms">MIN. SPEND ${fmtShort(v.min_order)}${v.expires_at ? ' · UNTIL ' + escapeHtml(v.expires_at) : ''}</div>
          </div>
          <div class="voucher-copy">
            <strong>${escapeHtml(value)}</strong>
            <button data-copy-voucher="${escapeAttr(v.code)}">COPY CODE</button>
          </div>
        </article>
      `;
    }).join('') : '<div class="empty-state">NO ACTIVE VOUCHERS RIGHT NOW.</div>';
  } catch (e) {
    const grid = $('#voucherGrid');
    if (grid) grid.innerHTML = '<div class="empty-state">VOUCHERS WILL BE BACK SOON.</div>';
  }
}

function openAuth(mode='login') {
  state.authMode = mode;
  $('#authTitle').innerHTML = mode === 'login' ? 'WELCOME<br>BACK<span class="period">.</span>' : 'JOIN THE<br>GOOD SIDE<span class="period">.</span>';
  $('#authSub').textContent = mode === 'login' ? 'Login buat lanjut pesan favoritmu.' : 'Bikin akun, simpan order, dan repeat your favorites.';
  $('#nameField').classList.toggle('hidden', mode !== 'register');
  $('#nameField input').required = mode === 'register';
  $('#authSubmit').innerHTML = mode === 'login' ? 'SIGN IN <span>➔</span>' : 'CREATE ACCOUNT <span>➔</span>';
  $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === mode));
  $('#authError').textContent = '';
  $('#authForm').reset();
  showModal('authModal');
}

$('#authForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const payload = Object.fromEntries(fd.entries());
  $('#authError').textContent = '';
  try {
    const data = await api(state.authMode === 'login' ? '/api/login' : '/api/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setUser(data.user);
    closePanels();
    toast(`Selamat datang, ${data.user.name}!`);
  } catch (err) {
    $('#authError').textContent = err.message;
  }
});

$$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => openAuth(b.dataset.authTab)));

function checkoutSummary() {
  return `
    <div class="bill-line"><span>${state.cart.reduce((s, x) => s + x.quantity, 0)} ITEMS · SUBTOTAL</span><b>${fmtShort(subtotal())}</b></div>
    <div class="bill-line discount-line"><span>VOUCHER ${state.voucherCode ? escapeHtml(state.voucherCode) : '—'}</span><b>−${fmtShort(state.discount)}</b></div>
    <div class="bill-line bill-total"><span>TOTAL</span><b>${fmtShort(subtotal() - state.discount)}</b></div>
  `;
}

function openCheckout() {
  if (!state.cart.length) {
    toast('Bag masih kosong.');
    return;
  }
  if (!state.user) {
    closePanels();
    openAuth('login');
    toast('Login dulu sebelum checkout.');
    return;
  }
  $('#checkoutError').textContent = '';
  $('#checkoutForm').reset();
  $('#checkoutSummary').innerHTML = checkoutSummary();
  const tableIn = $('#checkoutTableInput');
  const tableHint = $('#tableScanHint');
  if (state.tableNumber && tableIn) {
    tableIn.value = state.tableNumber;
    if (tableHint) tableHint.classList.remove('hidden');
  } else if (tableHint) {
    tableHint.classList.add('hidden');
  }
  closePanels();
  showModal('checkoutModal');
}

$('#checkoutForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.cart.length) return;
  const fd = new FormData(e.currentTarget);
  const d = Object.fromEntries(fd.entries());
  const tableNumber = String(d.tableNumber || '').trim();
  if (!tableNumber) {
    $('#checkoutError').textContent = 'Silakan masukkan nomor meja kamu.';
    return;
  }
  const payload = {
    items: state.cart.map(x => ({ id: x.id, quantity: x.quantity, options: x.options })),
    tableNumber,
    phone: d.phone || '',
    notes: d.notes || '',
    voucherCode: state.voucherCode
  };
  $('#checkoutError').textContent = '';
  const btn = $('#checkoutForm button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'MENGIRIM PESANAN...';
  try {
    const result = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.lastOrder = result.order;
    state.tableNumber = tableNumber;
    try { sessionStorage.setItem('blk_table', tableNumber); } catch {}
    renderTableBanner();
    state.cart = [];
    state.voucherCode = '';
    state.discount = 0;
    state.voucherDescription = '';
    renderCart();
    showSuccess(result.order);
  } catch (err) {
    $('#checkoutError').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'KIRIM PESANAN KE KASIR <span>➔</span>';
  }
});

function showSuccess(o) {
  $('#successCode').textContent = o.code;
  const tablePart = o.notes && o.notes.startsWith('[MEJA') ? `<div style="margin-bottom:6px"><b style="background:var(--yellow);padding:3px 6px;border:1.5px solid var(--ink);font-size:11px">${escapeHtml(o.notes.split(']')[0].replace('[',''))}</b></div>` : '';
  $('#successSummary').innerHTML = `
    ${tablePart}
    <div style="font-size:11px;color:#555;margin-bottom:8px"><b>MAKAN DI TEMPAT (DINE-IN)</b> · Bayar Langsung di Kasir</div>
    <div style="background:#f7f5ef;border:1.5px solid #dcd7ce;padding:10px;margin-bottom:10px">
      ${o.items.map(x => `<div><b>${x.quantity}×</b> ${escapeHtml(x.item_name)} ${x.options ? `<i>(${escapeHtml(x.options)})</i>` : ''}</div>`).join('')}
    </div>
    <div style="border-top:1.5px solid var(--ink);padding-top:8px;font-weight:900;font-size:13px">TOTAL TAGIHAN: ${fmtShort(o.total)}</div>
  `;
  closePanels();
  showModal('successModal');
}

$('#doneOrder')?.addEventListener('click', closePanels);

async function openHistory() {
  if (!state.user) {
    openAuth('login');
    return;
  }
  showModal('historyModal');
  $('#historyList').innerHTML = '<div class="loading-state">LOADING YOUR ORDERS...</div>';
  try {
    const orders = await api('/api/orders/mine');
    $('#historyList').innerHTML = orders.length ? orders.map(o => `
      <article class="history-order">
        <div class="history-order-head">
          <b>${escapeHtml(o.code)}</b>
          <span class="status-chip">${escapeHtml(o.status)}</span>
        </div>
        <p>
          ${new Date(o.created_at + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · ${escapeHtml(o.service_type)}<br>
          ${o.notes && o.notes.startsWith('[MEJA') ? `<b style="color:var(--orange)">${escapeHtml(o.notes.split(']')[0] + ']')}</b><br>` : ''}
          ${o.items.map(i => `${i.quantity}× ${escapeHtml(i.item_name)}`).join(', ')}
        </p>
        <div class="history-total">TOTAL ${fmtShort(o.total)}</div>
      </article>
    `).join('') : '<div class="empty-state">NO ORDERS YET. YOUR FIRST ONE IS WAITING.</div>';
  } catch (e) {
    $('#historyList').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}

// Upload helper function for drag & drop or file picker
async function uploadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Pilih file gambar valid (JPG, PNG, WEBP).'));
    }
    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error('Ukuran foto maksimal 8MB.'));
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ data: reader.result })
        });
        resolve(res.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

async function renderAdmin() {
  const host = $('#adminContent');
  if (!host) return;
  host.innerHTML = '<div class="loading-state">MEMUAT ADMIN DESK...</div>';

  try {
    if (state.adminTab === 'orders') {
      const [stats, orders] = await Promise.all([api('/api/admin/summary'), api('/api/admin/orders')]);
      state.adminOrders = orders;
      state.previousPendingCount = stats.pending;
      const filteredOrders = state.orderFilter === 'Semua' ? orders : orders.filter(o => o.status === state.orderFilter);

      host.innerHTML = `
        <div class="admin-stat-grid">
          <div class="admin-stat">
            <span>TOTAL ORDERS</span>
            <b>${stats.orders}</b>
          </div>
          <div class="admin-stat ${stats.pending > 0 ? 'alert-stat' : ''}">
            <span>PERLU PERHATIAN (PENDING)</span>
            <b>${stats.pending}</b>
          </div>
          <div class="admin-stat">
            <span>TOTAL OMZET TERCATAT</span>
            <b style="font-size:26px">${fmtShort(stats.revenue)}</b>
          </div>
          <div class="admin-stat">
            <span>MENU AKTIF</span>
            <b>${stats.menu}</b>
          </div>
        </div>

        <div class="admin-toolbar-row">
          <div class="admin-filter-bar">
            ${['Semua', 'Menunggu Konfirmasi', 'Dikonfirmasi', 'Diproses', 'Siap Diambil', 'Selesai', 'Dibatalkan'].map(st => `
              <button class="admin-filter-btn ${state.orderFilter === st ? 'active' : ''}" data-order-filter="${escapeAttr(st)}">${escapeHtml(st)}</button>
            `).join('')}
          </div>
          <button class="admin-action" id="refreshAdmin">↻ REFRESH DATA</button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="width:140px">KODE / WAKTU</th>
                <th style="width:170px">PELANGGAN & MEJA</th>
                <th>RINCIAN ITEM</th>
                <th style="width:120px">TOTAL</th>
                <th style="width:170px">STATUS ORDER</th>
                <th style="width:95px">AKSI</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOrders.length ? filteredOrders.map(o => `
                <tr>
                  <td>
                    <b style="font-size:13px">${escapeHtml(o.code)}</b><br>
                    <small style="color:#666">${escapeHtml(o.created_at)}</small>
                  </td>
                  <td>
                    <b>${escapeHtml(o.customer_name)}</b><br>
                    ${o.notes && o.notes.startsWith('[MEJA') ? `<span class="status-pill-badge" style="background:var(--yellow);margin-top:2px">${escapeHtml(o.notes.split(']')[0].replace('[',''))}</span><br>` : ''}
                    <span class="status-pill-badge" style="background:#e0f2fe">DINE-IN</span>
                    <span class="status-pill-badge" style="background:#fef3c7">KASIR</span>
                    ${o.phone ? `<br><small style="color:#666">${escapeHtml(o.phone)}</small>` : ''}
                  </td>
                  <td>
                    ${o.items.map(i => `<div><b>${i.quantity}×</b> ${escapeHtml(i.item_name)} ${i.options ? `<small style="color:#666">(${escapeHtml(i.options)})</small>` : ''}</div>`).join('')}
                    ${o.notes ? `<div style="margin-top:6px;padding:5px;background:#f5f3ee;border-left:2px solid var(--ink);font-size:9.5px"><i>${escapeHtml(o.notes)}</i></div>` : ''}
                  </td>
                  <td>
                    <b style="font-size:13px">${fmtShort(o.total)}</b>
                    ${o.discount > 0 ? `<br><small style="color:#27834a">Hemat ${fmtShort(o.discount)} (${escapeHtml(o.voucher_code)})</small>` : ''}
                  </td>
                  <td>
                    <select data-order-status="${o.id}" style="width:100%;font-weight:700">
                      ${['Menunggu Konfirmasi','Dikonfirmasi','Diproses','Siap Diambil','Selesai','Dibatalkan'].map(s => `
                        <option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td>
                    <button class="admin-action btn-save-menu" data-save-order="${o.id}">SIMPAN</button>
                    <button class="admin-action btn-print-receipt" data-print-order="${o.id}" title="Cetak struk kasir">🖨️ STRUK</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:#777">TIDAK ADA PESANAN DENGAN FILTER INI.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (state.adminTab === 'menu') {
      const items = await api('/api/admin/menu');
      state.adminMenuItems = items;

      host.innerHTML = `
        <div class="admin-toolbar-row">
          <div>
            <h3 style="font:900 28px 'Barlow Condensed',sans-serif;margin:0">KELOLA DAFTAR MENU & FOTO</h3>
            <span style="font-size:9px;color:#666">Atur nama, kategori, harga, badge, dan ganti foto via link atau drag & drop.</span>
          </div>
          <button class="admin-action btn-save-menu" id="toggleMenuForm" style="font-size:10px">+ TAMBAH MENU BARU</button>
        </div>

        <form id="adminMenuForm" class="admin-form hidden">
          <h4>TAMBAH MENU BARU</h4>
          <div class="admin-form-grid">
            <label class="form-field">NAMA MENU<input name="name" required placeholder="Contoh: Triple Beef Burger"></label>
            <label class="form-field">HARGA (RUPIAH)<input name="price" type="number" min="0" required placeholder="35000"></label>
            <label class="form-field">KATEGORI
              <select name="category">
                <option>Makanan</option>
                <option>Snack</option>
                <option>Minuman</option>
                <option>Dessert</option>
              </select>
            </label>
            <label class="form-field">BADGE PROMO / RASA (OPSIONAL)
              <input name="badge" id="newMenuBadgeInput" placeholder="Contoh: 🌶️ Pedas / ⭐ Best Seller">
              <div class="quick-badge-list">
                <span class="quick-badge-chip" data-badge-preset="🌶️ Pedas">🌶️ Pedas</span>
                <span class="quick-badge-chip" data-badge-preset="☕ Kopi">☕ Kopi</span>
                <span class="quick-badge-chip" data-badge-preset="🧊 Dingin">🧊 Dingin</span>
                <span class="quick-badge-chip" data-badge-preset="⭐ Best Seller">⭐ Best Seller</span>
                <span class="quick-badge-chip" data-badge-preset="🔥 Rekomendasi">🔥 Rekomendasi</span>
                <span class="quick-badge-chip" data-badge-preset="🌱 Veggie">🌱 Veggie</span>
              </div>
            </label>
            
            <div class="form-field" style="grid-column: 1 / -1">
              <span class="field-label">FOTO PRODUK (UPLOAD FILE / DRAG & DROP / LINK URL)</span>
              <div class="admin-dropzone" id="newMenuDropzone">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" y2="15"/></svg>
                <span class="admin-dropzone-title">Tarik & Lepas Foto ke Sini, atau Klik untuk Memilih File</span>
                <span class="admin-dropzone-sub">Mendukung format JPG, PNG, WEBP (Maksimal 8MB)</span>
                <input type="file" id="newMenuFileInput" accept="image/*" style="display:none">
              </div>
              <div style="margin-top:10px">
                <span style="font-size:9px;font-weight:900">ATAU PASTE LINK URL GAMBAR LANGSUNG:</span>
                <input name="image" id="newMenuImgInput" placeholder="https://images.unsplash.com/... atau URL foto lain" style="margin-top:4px">
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
                <div class="admin-img-preview-box">
                  <img id="newMenuImgPreview" src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80" alt="Preview Foto">
                </div>
                <span style="font-size:9px;color:#666">Preview foto menu saat ini</span>
              </div>
            </div>

            <label class="form-field" style="grid-column: 1 / -1">DESKRIPSI MENU<textarea name="description" rows="2" placeholder="Jelaskan cita rasa atau komposisi bahan menu..."></textarea></label>
          </div>
          <button class="btn btn-orange" type="submit">SIMPAN MENU BARU <span>➔</span></button>
          <div class="form-error" id="adminMenuError"></div>
        </form>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="width:90px">FOTO</th>
                <th style="width:190px">NAMA & DESKRIPSI</th>
                <th style="width:115px">KATEGORI</th>
                <th style="width:105px">HARGA (RP)</th>
                <th style="width:125px">BADGE / RASA</th>
                <th>LINK FOTO / UPLOAD</th>
                <th style="width:85px">STATUS</th>
                <th style="width:85px">AKSI</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(m => {
                const curImg = m.image || imageMap[m.name] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80';
                return `
                  <tr>
                    <td>
                      <div class="table-img-cell" style="position:relative">
                        <img class="admin-menu-thumb" id="thumb-${m.id}" src="${escapeAttr(curImg)}" alt="${escapeAttr(m.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80'">
                        <label class="table-img-upload-btn" title="Ganti foto dari file">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" y2="15"/></svg>
                          <span>Ganti</span>
                          <input type="file" data-file-for="${m.id}" accept="image/*" style="display:none">
                        </label>
                      </div>
                    </td>
                    <td>
                      <input data-name="${m.id}" value="${escapeAttr(m.name)}" style="width:100%;font-weight:800;margin-bottom:4px">
                      <input data-description="${m.id}" value="${escapeAttr(m.description||'')}" placeholder="Deskripsi menu..." style="width:100%;font-size:9.5px">
                    </td>
                    <td>
                      <select data-category-select="${m.id}" style="width:100%">
                        ${['Makanan','Snack','Minuman','Dessert'].map(c => `<option value="${c}" ${c === m.category ? 'selected' : ''}>${c}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <input type="number" data-price="${m.id}" value="${m.price}" style="width:100%">
                    </td>
                    <td>
                      <input data-badge="${m.id}" id="badge-input-${m.id}" value="${escapeAttr(m.badge||'')}" placeholder="Pilih/ketik..." style="width:100%">
                      <div class="quick-badge-list" style="margin-top:4px">
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="🌶️ Pedas">🌶️</span>
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="☕ Kopi">☕</span>
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="🧊 Dingin">🧊</span>
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="⭐ Best Seller">⭐</span>
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="🔥 Favorit">🔥</span>
                        <span class="quick-badge-chip" data-badge-target="${m.id}" data-badge-val="🌱 Veggie">🌱</span>
                      </div>
                    </td>
                    <td>
                      <div class="admin-img-cell">
                        <input data-image="${m.id}" id="input-img-${m.id}" value="${escapeAttr(m.image||'')}" placeholder="Paste URL atau upload..." oninput="const img=document.getElementById('thumb-${m.id}'); if(img) img.src=this.value || imageMap['${escapeAttr(m.name)}'] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80'">
                        <small class="hint-text">Bisa ketik link atau upload foto langsung via tombol di kiri</small>
                      </div>
                    </td>
                    <td>
                      <span class="status-pill-badge ${m.available ? 'status-pill-active' : 'status-pill-hidden'}">
                        ${m.available ? 'TERSEDIA' : 'DISEMBUNYIKAN'}
                      </span>
                    </td>
                    <td>
                      <button class="btn-save-menu" data-update-menu="${m.id}">💾 SIMPAN</button>
                      <button class="btn-del-menu" data-hide-menu="${m.id}">${m.available ? 'SEMBUNYIKAN' : 'TAMPILKAN'}</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Setup dropzone for new menu form
      const dropzone = $('#newMenuDropzone');
      const fileInput = $('#newMenuFileInput');
      const imgInput = $('#newMenuImgInput');
      const imgPreview = $('#newMenuImgPreview');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', e => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', async e => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            try {
              toast('Mengunggah gambar...');
              const url = await uploadImageFile(e.dataTransfer.files[0]);
              if (imgInput) imgInput.value = url;
              if (imgPreview) imgPreview.src = url;
              toast('Foto berhasil diunggah!');
            } catch (err) {
              toast(err.message);
            }
          }
        });
        fileInput.addEventListener('change', async () => {
          if (fileInput.files && fileInput.files[0]) {
            try {
              toast('Mengunggah gambar...');
              const url = await uploadImageFile(fileInput.files[0]);
              if (imgInput) imgInput.value = url;
              if (imgPreview) imgPreview.src = url;
              toast('Foto berhasil diunggah!');
            } catch (err) {
              toast(err.message);
            }
          }
        });
      }

      if (imgInput && imgPreview) {
        imgInput.addEventListener('input', () => {
          imgPreview.src = imgInput.value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80';
        });
      }
    } else if (state.adminTab === 'vouchers') {
      const vouchers = await api('/api/admin/vouchers');
      host.innerHTML = `
        <div class="admin-toolbar-row">
          <div>
            <h3 style="font:900 28px 'Barlow Condensed',sans-serif;margin:0">KELOLA KODE VOUCHER</h3>
            <span style="font-size:9px;color:#666">Buat promo diskon persentase atau potongan nominal untuk pelanggan.</span>
          </div>
          <button class="admin-action btn-save-menu" id="toggleVoucherForm" style="font-size:10px">+ TAMBAH VOUCHER BARU</button>
        </div>

        <form id="adminVoucherForm" class="admin-form hidden">
          <h4>TAMBAH VOUCHER BARU</h4>
          <div class="admin-form-grid">
            <label class="form-field">KODE VOUCHER<input name="code" required placeholder="Contoh: PROMOJUMAT" style="text-transform:uppercase"></label>
            <label class="form-field">DESKRIPSI PROMO<input name="description" placeholder="Contoh: Diskon 25% order minimal 50rb"></label>
            <label class="form-field">TIPE DISKON
              <select name="type">
                <option value="percent">Persentase (%)</option>
                <option value="fixed">Potongan Nominal (Rp)</option>
              </select>
            </label>
            <label class="form-field">NILAI POTONGAN<input name="value" type="number" min="1" required placeholder="Contoh: 20 (untuk 20%) atau 15000 (untuk Rp15.000)"></label>
            <label class="form-field">MINIMAL BELANJA (RP)<input name="min_order" type="number" min="0" value="0"></label>
            <label class="form-field">MAKSIMAL DISKON (RP, OPSIONAL)<input name="max_discount" type="number" min="0" placeholder="Kosongkan jika tanpa batas"></label>
            <label class="form-field">BATAS KUOTA PEMAKAIAN (OPSIONAL)<input name="usage_limit" type="number" min="1" placeholder="Kosongkan jika kuota bebas"></label>
            <label class="form-field">TANGGAL KEDALUWARSA<input name="expires_at" type="date"></label>
          </div>
          <button class="btn btn-orange" type="submit">SIMPAN VOUCHER <span>➔</span></button>
          <div class="form-error" id="adminVoucherError"></div>
        </form>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>KODE</th>
                <th>JENIS PROMO</th>
                <th>MIN. BELANJA</th>
                <th>PEMAKAIAN</th>
                <th>BERLAKU SAMPAI</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              ${vouchers.map(v => `
                <tr>
                  <td><b style="font-size:14px">${escapeHtml(v.code)}</b></td>
                  <td>
                    <b>${v.type === 'percent' ? v.value + '%' : fmtShort(v.value)}</b><br>
                    <small style="color:#666">${escapeHtml(v.description || '')}</small>
                  </td>
                  <td>${fmtShort(v.min_order)}</td>
                  <td><b>${v.used_count}</b>${v.usage_limit === null ? ' kali' : ' / ' + v.usage_limit}</td>
                  <td>${escapeHtml(v.expires_at || 'Tanpa Batas')}</td>
                  <td>
                    <span class="status-pill-badge ${v.active ? 'status-pill-active' : 'status-pill-hidden'}">
                      ${v.active ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                  <td>
                    <button class="admin-action" data-toggle-voucher="${v.id}" data-active="${v.active ? 0 : 1}">
                      ${v.active ? 'NONAKTIFKAN' : 'AKTIFKAN'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (state.adminTab === 'tables') {
      const presets = state.tablePresets;
      host.innerHTML = `
        <div class="admin-toolbar-row">
          <div>
            <h3 style="font:900 28px 'Barlow Condensed',sans-serif;margin:0">KELOLA & CETAK QR CODE MEJA (DINE-IN)</h3>
            <span style="font-size:9px;color:#666">Cetak kartu meja ber-QR Code untuk ditaruh di masing-masing meja cafe. Pelanggan scan untuk pesan otomatis ke meja tersebut.</span>
          </div>
          <button class="admin-action btn-save-menu" id="printAllTablesBtn" style="font-size:10px">🖨️ CETAK SEMUA STIKER (MEJA 01 - 10)</button>
        </div>

        <div style="background:#fffefa;border:2px solid var(--ink);padding:14px;margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:900">GENERATE LINK / QR CUSTOM MEJA:</span>
          <input id="customTableInput" placeholder="Contoh: VIP-01 atau Meja Rooftop" style="border:1.5px solid var(--ink);padding:7px 10px;font-size:10px;min-width:200px">
          <button class="admin-action" id="generateCustomTableBtn">BUAT & CETAK QR</button>
        </div>

        <div class="table-qr-grid">
          ${presets.map(t => {
            const url = `${window.location.origin}/?table=${encodeURIComponent(t)}`;
            const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            return `
              <div class="table-qr-card">
                <span class="table-badge-tag">DINE-IN QR</span>
                <div class="table-num-large">MEJA ${escapeHtml(t)}</div>
                <img class="table-qr-img" src="${qrImg}" alt="QR Meja ${escapeHtml(t)}">
                <div style="font-size:9px;color:#666;word-break:break-all;margin-bottom:8px">?table=${escapeHtml(t)}</div>
                <div class="table-qr-actions">
                  <button class="admin-action" data-copy-table-link="${escapeAttr(t)}">📋 SALIN LINK</button>
                  <button class="admin-action" data-print-table-card="${escapeAttr(t)}">🖨️ CETAK STAND</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  } catch (e) {
    host.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}<br><br>Pastikan akun kamu memiliki role admin.</div>`;
  }
}

$$('[data-admin-tab]').forEach(b => b.addEventListener('click', () => {
  state.adminTab = b.dataset.adminTab;
  $$('[data-admin-tab]').forEach(x => x.classList.toggle('active', x.dataset.adminTab === state.adminTab));
  renderAdmin();
}));

document.addEventListener('change', async e => {
  const fileFor = e.target.dataset.fileFor;
  if (fileFor && e.target.files && e.target.files[0]) {
    try {
      toast('Mengunggah foto menu...');
      const url = await uploadImageFile(e.target.files[0]);
      const input = $(`#input-img-${fileFor}`);
      const thumb = $(`#thumb-${fileFor}`);
      if (input) input.value = url;
      if (thumb) thumb.src = url;
      toast('Foto berhasil diunggah! Klik SIMPAN untuk menyimpan perubahan.');
    } catch (err) {
      toast(err.message);
    }
  }
});

document.addEventListener('click', async e => {
  const add = e.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add);
    return;
  }
  const qty = e.target.closest('[data-qty]');
  if (qty) {
    const item = state.cart.find(x => x.id === Number(qty.dataset.qty));
    if (item) {
      item.quantity += Number(qty.dataset.delta);
      if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== item.id);
      if (item.quantity > 50) item.quantity = 50;
      state.discount = 0;
      state.voucherCode = '';
      renderCart();
    }
    return;
  }
  const copy = e.target.closest('[data-copy-voucher]');
  if (copy) {
    const code = copy.dataset.copyVoucher;
    try {
      await navigator.clipboard.writeText(code);
      toast(`${code} copied. Tambahkan di bag saat checkout.`);
    } catch {
      toast(`Kode voucher: ${code}`);
    }
    return;
  }
  const filterBtn = e.target.closest('[data-order-filter]');
  if (filterBtn) {
    state.orderFilter = filterBtn.dataset.orderFilter;
    renderAdmin();
    return;
  }
  const saveOrder = e.target.closest('[data-save-order]');
  if (saveOrder) {
    const id = saveOrder.dataset.saveOrder;
    const select = $(`[data-order-status="${id}"]`);
    const status = select ? select.value : '';
    try {
      await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast('Status order berhasil diperbarui.');
      renderAdmin();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const updateMenu = e.target.closest('[data-update-menu]');
  if (updateMenu) {
    const id = updateMenu.dataset.updateMenu;
    const name = $(`[data-name="${id}"]`)?.value;
    const price = $(`[data-price="${id}"]`)?.value;
    const category = $(`[data-category-select="${id}"]`)?.value;
    const badge = $(`[data-badge="${id}"]`)?.value;
    const image = $(`[data-image="${id}"]`)?.value;
    const description = $(`[data-description="${id}"]`)?.value;
    try {
      await api(`/api/admin/menu/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, price, category, badge, image, description })
      });
      toast('Menu & foto berhasil disimpan!');
      await Promise.all([renderAdmin(), loadMenu()]);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const hideMenu = e.target.closest('[data-hide-menu]');
  if (hideMenu) {
    const id = hideMenu.dataset.hideMenu;
    const item = (state.adminMenuItems || []).find(x => x.id === Number(id));
    const newAvailable = item ? (item.available ? 0 : 1) : 0;
    try {
      await api(`/api/admin/menu/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: newAvailable })
      });
      toast(newAvailable ? 'Menu diaktifkan kembali.' : 'Menu disembunyikan dari katalog.');
      await Promise.all([renderAdmin(), loadMenu()]);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const toggleVoucher = e.target.closest('[data-toggle-voucher]');
  if (toggleVoucher) {
    try {
      await api(`/api/admin/vouchers/${toggleVoucher.dataset.toggleVoucher}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: Number(toggleVoucher.dataset.active) })
      });
      toast('Status voucher diperbarui.');
      renderAdmin();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const printOrder = e.target.closest('[data-print-order]');
  if (printOrder) {
    printReceipt(printOrder.dataset.printOrder);
    return;
  }
  const badgePreset = e.target.closest('[data-badge-preset]');
  if (badgePreset) {
    const input = $('#newMenuBadgeInput');
    if (input) {
      input.value = badgePreset.dataset.badgePreset;
      toast(`Badge dipilih: ${badgePreset.dataset.badgePreset}`);
    }
    return;
  }
  const badgeTarget = e.target.closest('[data-badge-target]');
  if (badgeTarget) {
    const id = badgeTarget.dataset.badgeTarget;
    const val = badgeTarget.dataset.badgeVal;
    const input = $(`#badge-input-${id}`);
    if (input) {
      input.value = val;
      toast(`Badge diset ke: ${val}`);
    }
    return;
  }
  const copyTable = e.target.closest('[data-copy-table-link]');
  if (copyTable) {
    const t = copyTable.dataset.copyTableLink;
    const url = `${window.location.origin}/?table=${encodeURIComponent(t)}`;
    navigator.clipboard.writeText(url)
      .then(() => toast(`Link Meja ${t} disalin ke clipboard!`))
      .catch(() => prompt('Salin link meja ini:', url));
    return;
  }
  const printTable = e.target.closest('[data-print-table-card]');
  if (printTable) {
    printTableTentCard(printTable.dataset.printTableCard);
    return;
  }
  if (e.target.id === 'printAllTablesBtn') {
    printAllTableStickers();
    return;
  }
  if (e.target.id === 'generateCustomTableBtn') {
    const input = $('#customTableInput');
    const val = input ? input.value.trim() : '';
    if (!val) {
      toast('Ketik nomor/nama meja terlebih dahulu.');
      return;
    }
    printTableTentCard(val);
    return;
  }
  if (e.target.id === 'changeTableBtn') {
    const current = state.tableNumber || '';
    const newT = prompt('Masukkan nomor meja Anda:', current);
    if (newT !== null) {
      state.tableNumber = newT.trim();
      try { sessionStorage.setItem('blk_table', state.tableNumber); } catch {}
      renderTableBanner();
      toast(state.tableNumber ? `Nomor meja diatur ke: Meja ${state.tableNumber}` : 'Nomor meja dibersihkan.');
    }
    return;
  }
  if (e.target.id === 'dismissTableBtn') {
    $('#tableNotice')?.classList.add('hidden');
    return;
  }
  if (e.target.id === 'soundToggleBtn' || e.target.closest('#soundToggleBtn')) {
    state.soundEnabled = !state.soundEnabled;
    try { localStorage.setItem('blk_sound_enabled', state.soundEnabled ? '1' : '0'); } catch {}
    updateSoundButton();
    if (state.soundEnabled) {
      playOrderBell();
      toast('🔔 Bel pesanan baru DIAKTIFKAN.');
    } else {
      toast('🔕 Bel pesanan baru DIBISUKAN.');
    }
    return;
  }
  if (e.target.id === 'testSoundBtn' || e.target.closest('#testSoundBtn')) {
    state.soundEnabled = true;
    updateSoundButton();
    playOrderBell();
    toast('🎵 Memutar nada bel pesanan...');
    return;
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id === 'adminMenuForm') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const b = Object.fromEntries(fd.entries());
    try {
      await api('/api/admin/menu', { method: 'POST', body: JSON.stringify(b) });
      toast('Menu baru berhasil ditambahkan.');
      await Promise.all([renderAdmin(), loadMenu()]);
    } catch (err) {
      const errEl = $('#adminMenuError');
      if (errEl) errEl.textContent = err.message;
    }
  }
  if (e.target.id === 'adminVoucherForm') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const b = Object.fromEntries(fd.entries());
    try {
      await api('/api/admin/vouchers', { method: 'POST', body: JSON.stringify(b) });
      toast('Voucher baru berhasil ditambahkan.');
      renderAdmin();
      loadVouchers();
    } catch (err) {
      const errEl = $('#adminVoucherError');
      if (errEl) errEl.textContent = err.message;
    }
  }
});

document.addEventListener('click', e => {
  if (e.target.id === 'toggleMenuForm') {
    const form = $('#adminMenuForm');
    if (form) form.classList.toggle('hidden');
  }
  if (e.target.id === 'toggleVoucherForm') {
    const form = $('#adminVoucherForm');
    if (form) form.classList.toggle('hidden');
  }
  if (e.target.id === 'refreshAdmin') {
    renderAdmin();
  }
});

$('#previewStoreBtn')?.addEventListener('click', () => {
  setViewMode('storefront');
  toast('Beralih ke tampilan web pelanggan.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('#returnToAdminBtn')?.addEventListener('click', () => {
  setViewMode('admin');
});

$('#adminLogoutBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
    setUser(null);
    toast('Kamu sudah logout.');
  } catch (err) {
    toast(err.message);
  }
});

$('#accountBtn')?.addEventListener('click', () => {
  if (!state.user) {
    openAuth('login');
    return;
  }
  if (state.user.role === 'admin') {
    setViewMode('admin');
    return;
  }
  const choice = confirm(`Login sebagai ${state.user.name}.\nOK = lihat riwayat order\nCancel = logout`);
  if (choice) openHistory();
  else api('/api/logout', { method: 'POST' }).then(() => { setUser(null); toast('Kamu sudah logout.'); }).catch(() => {});
});

$('#cartBtn')?.addEventListener('click', openCart);
$('#overlay')?.addEventListener('click', closePanels);
$$('[data-close]').forEach(b => b.addEventListener('click', closePanels));
$('#checkoutBtn')?.addEventListener('click', openCheckout);
$('#applyVoucher')?.addEventListener('click', applyVoucher);
$('#cartVoucher')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyVoucher();
  }
});
$('#searchInput')?.addEventListener('input', e => {
  state.query = e.target.value;
  renderMenu();
});
$$('[data-category]').forEach(b => b.addEventListener('click', () => {
  state.category = b.dataset.category;
  $$('[data-category]').forEach(x => x.classList.toggle('active', x === b));
  renderMenu();
}));

// Mobile Hamburger Navigation Fix: Clean Toggle & Click Outside Handler
$('#menuToggle')?.addEventListener('click', e => {
  e.stopPropagation();
  const nav = $('.main-nav');
  const btn = $('#menuToggle');
  if (nav) nav.classList.toggle('open');
  if (btn) btn.classList.toggle('active');
});

$$('.main-nav a').forEach(a => a.addEventListener('click', () => {
  $('.main-nav')?.classList.remove('open');
  $('#menuToggle')?.classList.remove('active');
}));

document.addEventListener('click', e => {
  if (!e.target.closest('.main-nav') && !e.target.closest('#menuToggle')) {
    $('.main-nav')?.classList.remove('open');
    $('#menuToggle')?.classList.remove('active');
  }
});

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const tableParam = urlParams.get('table') || urlParams.get('meja');
  if (tableParam) {
    state.tableNumber = tableParam.trim();
    try { sessionStorage.setItem('blk_table', state.tableNumber); } catch {}
  } else {
    try { state.tableNumber = sessionStorage.getItem('blk_table') || ''; } catch {}
  }
  renderTableBanner();
  updateSoundButton();

  try {
    const cfg = await api('/api/config');
    setUser(cfg.user);
  } catch {}
  await Promise.all([loadMenu(), loadVouchers()]);
}

init();

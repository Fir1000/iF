/* =====================================================================
   supabase.js — ตั้งค่า Supabase + ฟังก์ชันที่ใช้ร่วมกันทุกหน้า
   ===================================================================== */

// ▼▼▼ ใส่ค่าจาก Supabase Dashboard > Project Settings > API ▼▼▼
const SUPABASE_URL = 'https://optmecnjttttduazwiso.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eStQmcoJ3-oAzDoo0W-X6Q_Tb_EdugS';
// ▲▲▲ ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด ▲▲▲

const SHOP = {
  name: 'iF',
  lineId: '141414dw',
  facebook: 'https://www.facebook.com/share/1C79rC3M53/'
};

// รูปร้านค้า (stores/...) และรูปสินค้า (products/...) เก็บใน bucket เดียวกัน
const STORAGE_BUCKET = 'shop-images';

const ORDER_STATUS = {
  pending:   { label: 'รอรับออเดอร์',       cls: 'st-pending' },
  accepted:  { label: 'รับออเดอร์แล้ว',     cls: 'st-confirmed' },
  preparing: { label: 'กำลังเตรียมสินค้า',  cls: 'st-preparing' },
  ready:     { label: 'พร้อมรับสินค้า',      cls: 'st-shipping' },
  completed: { label: 'เสร็จสิ้น',           cls: 'st-completed' },
  cancelled: { label: 'ยกเลิก',             cls: 'st-cancelled' }
};

const LINE_URL = 'https://line.me/ti/p/~' + encodeURIComponent(SHOP.lineId);

function isConfigured() {
  return !SUPABASE_URL.includes('YOUR_PROJECT_ID') && !SUPABASE_ANON_KEY.includes('YOUR_');
}

if (!window.supabase || !window.supabase.createClient) {
  console.error('ไม่พบไลบรารี Supabase — ตรวจสอบ <script> CDN ในหน้า HTML');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* ---------- Helpers ---------- */

function formatPrice(n) {
  const num = Number(n || 0);
  return '฿' + num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeImageUrl(url) {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) return escapeHtml(url);
  return PLACEHOLDER_IMG;
}

// รูปแทนเมื่อร้าน/สินค้ายังไม่มีรูป: ไรเดอร์มอเตอร์ไซค์ + ดาว
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
  '<rect width="400" height="300" fill="#fff0e3"/>' +
  '<g transform="translate(95 30) scale(1.1)" fill="none" stroke="#f5a66f" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M8 96h34M18 112h28M4 128h30" stroke-width="6"/>' +
  '<circle cx="72" cy="150" r="20" stroke-width="9"/><circle cx="160" cy="150" r="20" stroke-width="9"/>' +
  '<path d="M72 150h50l22-44h-26M144 106l16 44" stroke-width="9"/><path d="M98 150c-2-22 8-34 26-36" stroke-width="9"/>' +
  '<rect x="58" y="76" width="40" height="40" rx="6" stroke-width="8"/>' +
  '<path d="M138 106l-10-26h14" stroke-width="8"/><circle cx="128" cy="58" r="12" stroke-width="8"/></g>' +
  '<polygon points="335,58 340.3,72.7 355.9,73.2 343.6,82.8 347.9,97.8 335,89 322.1,97.8 326.4,82.8 314.1,73.2 329.7,72.7" ' +
  'fill="#f5b301" stroke="#f5b301" stroke-width="3" stroke-linejoin="round"/></svg>'
);

function storeStatusBadge(status) {
  return status === 'open'
    ? '<span class="store-status open">● เปิดอยู่</span>'
    : '<span class="store-status closed">● ปิดอยู่</span>';
}

// รับเฉพาะ uuid (ใช้กับ ?id= ใน URL)
function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function statusBadge(status) {
  const s = ORDER_STATUS[status] || { label: status, cls: '' };
  return `<span class="status-badge ${s.cls}">${escapeHtml(s.label)}</span>`;
}

function translateError(err) {
  const msg = (err && (err.message || err.error_description || String(err))) || 'เกิดข้อผิดพลาด';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  if (/Invalid login credentials/i.test(msg)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (/already registered|already been registered/i.test(msg)) return 'อีเมลนี้สมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ';
  if (/Password should be at least/i.test(msg)) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร';
  if (/Signups not allowed|signup.*disabled/i.test(msg)) return 'ระบบยังไม่เปิดให้สมัครสมาชิก กรุณาติดต่อร้าน';
  if (/rate limit|too many/i.test(msg)) return 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (/Unable to validate email|invalid.*email/i.test(msg)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (/Email not confirmed/i.test(msg)) return 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล';
  if (/row-level security|permission denied|42501/i.test(msg)) return 'ไม่มีสิทธิ์ดำเนินการนี้';
  if (/JWT|expired/i.test(msg)) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (/stock_check/i.test(msg)) return 'จำนวนสต็อกต้องไม่ติดลบ';
  if (/price_check/i.test(msg)) return 'ราคาต้องไม่ติดลบ';
  if (/shop_categories_store_id_name_key/i.test(msg)) return 'ร้านนี้มีหมวดหมู่ชื่อนี้อยู่แล้ว';
  if (/shop_addresses_name_key/i.test(msg)) return 'มีที่อยู่ชื่อนี้อยู่แล้ว';
  if (/shop_products_category_id_store_id_fkey/i.test(msg)) return 'หมวดหมู่นี้ไม่ใช่ของร้านที่เลือก (หรือถูกลบไปแล้ว) กรุณาเลือกใหม่';
  if (/invalid input syntax/i.test(msg)) return 'ข้อมูลไม่ถูกต้อง';
  return msg;
}

function showToast(message, type = 'info', ms = 3200) {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

function configNoticeHtml() {
  return `<div class="notice notice-warn">
    <strong>ยังไม่ได้เชื่อมต่อ Supabase</strong><br>
    กรุณาใส่ <code>SUPABASE_URL</code> และ <code>SUPABASE_ANON_KEY</code> ในไฟล์ <code>js/supabase.js</code>
  </div>`;
}

/* ---------- บัญชีผู้ใช้ (ลูกค้า + Admin ใช้หน้า login.html เดียวกัน) ---------- */

const Auth = {
  async session() {
    if (!isConfigured()) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async isAdmin() {
    const { data, error } = await sb.rpc('shop_is_admin');
    return !error && data === true;
  },

  // ไปหน้า login แล้วกลับมาหน้าเดิมหลังเข้าสู่ระบบ
  loginUrl(next = location.pathname.split('/').pop() || 'index.html') {
    return 'login.html?next=' + encodeURIComponent(next);
  },

  // รับเฉพาะหน้าในเว็บนี้ (กัน open redirect)
  safeNext(next) {
    return typeof next === 'string' && /^[\w-]+(\/[\w-]+)?\.html$/.test(next) && next !== 'login.html' ? next : '';
  },

  async logout(to = 'index.html') {
    await sb.auth.signOut();
    location.replace(to);
  }
};

// ปุ่มบัญชีบน navbar: ยังไม่ล็อกอิน = "เข้าสู่ระบบ" / ลูกค้า = "คำสั่งซื้อของฉัน" / Admin = "หลังร้าน"
async function initAccountLink() {
  const link = document.querySelector('[data-account-link]');
  if (!link) return;
  const label = link.querySelector('.account-label');
  const set = (href, text) => { link.href = href; label.textContent = text; link.setAttribute('aria-label', text); };

  const session = await Auth.session().catch(() => null);
  if (!session) { set(Auth.loginUrl(), 'เข้าสู่ระบบ'); return; }
  if (await Auth.isAdmin()) set('admin/dashboard.html', 'หลังร้าน');
  else set('my-orders.html', 'คำสั่งซื้อของฉัน');
}

/* ---------- UI ร่วมของหน้าลูกค้า ---------- */

function initCommonUI() {
  // ลิงก์ LINE ทุกจุด
  document.querySelectorAll('[data-line-link]').forEach(a => {
    a.href = LINE_URL;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('[data-facebook-link]').forEach(a => {
    a.href = SHOP.facebook;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear() + 543; });
  initAccountLink();

  // เมนูมือถือ
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }
}

document.addEventListener('DOMContentLoaded', initCommonUI);

// ติดตั้งเป็นแอปบนมือถือ (PWA): sw.js อยู่ข้าง manifest.json ที่รากเว็บ
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', manifest.href).href)
        .catch(err => console.warn('ลงทะเบียน Service Worker ไม่สำเร็จ', err));
    });
  }
}

/* =====================================================================
   admin.js — ระบบหลังร้าน (Multi-Store): Dashboard, ร้านค้า (= หมวดหมู่), สินค้า, คำสั่งซื้อ
   หน้าไหนทำงานส่วนไหน ดูจาก <body data-page="...">
   ===================================================================== */

// หน้า login ใช้ร่วมกับลูกค้า (../login.html) — Admin เข้าแล้วถูกส่งมาที่หลังร้านอัตโนมัติ
const LOGIN_URL = '../login.html?next=' + encodeURIComponent('admin/' + (location.pathname.split('/').pop() || 'dashboard.html'));
const ADMIN_STORE_KEY = 'if_admin_store';

const Admin = {
  session: null,
  redirecting: false,

  async requireAdmin() {
    const loading = document.getElementById('adminLoading');
    if (!isConfigured()) { loading.innerHTML = configNoticeHtml(); return false; }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { this.go(LOGIN_URL); return false; }

    const { data: isAdmin, error } = await sb.rpc('shop_is_admin');
    if (error || !isAdmin) {
      this.redirecting = true;
      await sb.auth.signOut();
      this.go('../login.html?error=notadmin');
      return false;
    }

    this.session = session;
    document.getElementById('adminEmail').textContent = session.user.email || '';
    loading.remove();
    document.getElementById('adminShell').hidden = false;
    return true;
  },

  go(url) { this.redirecting = true; location.replace(url); },

  async logout() {
    this.redirecting = true;
    await sb.auth.signOut();
    location.replace('../login.html');
  }
};

sb.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT' && !Admin.redirecting) {
    location.replace(LOGIN_URL);
  }
});

function initShell() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => Admin.logout());
  const sidebar = document.getElementById('adminSidebar');
  const btn = document.getElementById('adminMenuBtn');
  const backdrop = document.getElementById('sidebarBackdrop');
  const close = () => { sidebar.classList.remove('open'); backdrop.hidden = true; };
  btn?.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.hidden = false; });
  backdrop?.addEventListener('click', close);
}

/* ---------- แจ้งเตือนออเดอร์ใหม่: เสียง + สั่น + กระพริบชื่อแท็บ (ทุกหน้า admin) ---------- */

const SOUND_KEY = 'if_admin_sound';

const OrderAlert = {
  ctx: null,
  enabled: (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } })(),
  unread: 0,
  baseTitle: document.title,
  onNew: null,   // หน้าที่เปิดอยู่ตั้งไว้เพื่อโหลดข้อมูลใหม่

  // เบราว์เซอร์ให้เล่นเสียงได้หลังผู้ใช้แตะหน้าเว็บอย่างน้อย 1 ครั้ง
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.renderButton();
  },

  ready() { return !!this.ctx && this.ctx.state === 'running'; },

  // เสียงกริ๊ง 3 โน้ตขึ้น เล่น 2 รอบ (สังเคราะห์เอง ไม่ต้องมีไฟล์เสียง)
  chime() {
    if (!this.enabled || !this.ready()) return;
    const t0 = this.ctx.currentTime + 0.02;
    [0, 0.75].forEach(offset => {
      [880, 1175, 1568].forEach((freq, i) => {
        const at = t0 + offset + i * 0.16;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(at);
        osc.stop(at + 0.5);
      });
    });
  },

  notify(order) {
    showToast(`🛒 ออเดอร์ใหม่ ${order?.order_number || ''} — ${order?.store_name || ''}`, 'success', 6000);
    this.chime();
    if (this.enabled) navigator.vibrate?.([200, 100, 200]);
    if (document.hidden) {
      this.unread++;
      document.title = `(${this.unread}) 🛒 ออเดอร์ใหม่! · ${this.baseTitle}`;
    }
    this.onNew?.();
  },

  renderButton() {
    const btn = document.getElementById('soundBtn');
    if (!btn) return;
    const on = this.enabled;
    btn.textContent = !on ? '🔕 เสียงปิด' : this.ready() ? '🔔 เสียงเปิด' : '🔔 แตะเพื่อเปิดเสียง';
    btn.classList.toggle('off', !on);
    btn.classList.toggle('pending', on && !this.ready());
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'มีออเดอร์ใหม่จะมีเสียงแจ้งเตือน — กดเพื่อปิดเสียง' : 'กดเพื่อเปิดเสียงแจ้งเตือนออเดอร์ใหม่';
  },

  start() {
    const topbar = document.querySelector('.admin-topbar');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'soundBtn';
    btn.className = 'sound-btn';
    topbar?.insertBefore(btn, document.getElementById('adminEmail'));
    btn.addEventListener('click', () => {
      if (this.enabled && !this.ready()) { this.unlock(); this.chime(); return; }
      this.enabled = !this.enabled;
      try { localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off'); } catch { /* ignore */ }
      this.unlock();
      if (this.enabled) this.chime();   // เล่นตัวอย่างให้ได้ยิน
      this.renderButton();
    });
    // แตะตรงไหนก็ได้ครั้งแรก = ปลดล็อกเสียง
    const first = () => this.unlock();
    document.addEventListener('pointerdown', first, { once: true });
    document.addEventListener('keydown', first, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.unread = 0; document.title = this.baseTitle; }
    });
    this.renderButton();

    sb.channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_orders' }, payload => this.notify(payload.new))
      .subscribe();
  }
};

function subscribeNewOrders(onNew) {
  OrderAlert.onNew = onNew;
}

/* ---------- ตัวเลือกร้านค้า (ใช้ร่วมหลายหน้า) ---------- */

async function fetchStores() {
  const { data, error } = await sb.from('shop_stores')
    .select('id,name,description,image_url,status,sort_order,created_at')
    .order('sort_order').order('created_at');
  if (error) throw error;
  return data || [];
}

// เติม <select> ด้วยรายชื่อร้าน และจำร้านที่เลือกล่าสุดไว้ (?store= ใน URL มาก่อน)
function fillStoreSelect(select, stores, { allowAll = false } = {}) {
  select.innerHTML = (allowAll ? '<option value="">ทุกร้านค้า</option>' : '') +
    stores.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.status === 'open' ? '' : ' (ปิดอยู่)'}</option>`).join('');

  const fromUrl = new URLSearchParams(location.search).get('store');
  let saved = '';
  try { saved = localStorage.getItem(ADMIN_STORE_KEY) || ''; } catch { /* storage ไม่พร้อม */ }
  const pick = [fromUrl, saved].find(id => id && stores.some(s => s.id === id));
  select.value = pick || (allowAll ? '' : stores[0]?.id || '');

  select.addEventListener('change', () => {
    try { if (select.value) localStorage.setItem(ADMIN_STORE_KEY, select.value); } catch { /* ignore */ }
  });
}

function noStoresHtml(colspan) {
  const inner = 'ยังไม่มีร้านค้า — <a href="stores.html?new=1">เพิ่มร้านค้าแรก</a> ก่อน';
  return colspan ? `<tr><td colspan="${colspan}" class="muted center">${inner}</td></tr>` : `<p class="muted center">${inner}</p>`;
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */

async function initDashboard() {
  const filter = document.getElementById('dashStore');
  const stores = await fetchStores();
  fillStoreSelect(filter, stores, { allowAll: true });

  async function loadStats() {
    const { data, error } = await sb.rpc('shop_admin_dashboard_stats', { p_store_id: filter.value || null });
    if (error) { showToast(translateError(error), 'error'); return; }
    const n = v => Number(v).toLocaleString('th-TH');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('statStores', `${n(data.open_stores)} / ${n(data.total_stores)}`);
    set('statTotalProducts', n(data.total_products));
    set('statOutStock', n(data.out_of_stock));
    set('statTotalOrders', n(data.total_orders));
    set('statSales', formatPrice(data.total_sales));
    set('statPending', n(data.pending_orders));
    set('statToday', formatPrice(data.today_sales));
  }

  async function loadRecent() {
    const tbody = document.getElementById('recentOrders');
    let q = sb.from('shop_orders')
      .select('id,order_number,store_name,customer_name,total_amount,status,created_at')
      .order('created_at', { ascending: false }).limit(6);
    if (filter.value) q = q.eq('store_id', filter.value);
    const { data, error } = await q;
    if (error) { tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(translateError(error))}</td></tr>`; return; }
    tbody.innerHTML = data.length ? data.map(o => `
      <tr>
        <td data-label="เลข Order"><strong class="mono">${escapeHtml(o.order_number)}</strong></td>
        <td data-label="ร้านค้า">${escapeHtml(o.store_name)}</td>
        <td data-label="ลูกค้า">${escapeHtml(o.customer_name)}</td>
        <td data-label="ยอดรวม" class="num">${formatPrice(o.total_amount)}</td>
        <td data-label="สถานะ">${statusBadge(o.status)}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="muted center">ยังไม่มีคำสั่งซื้อ</td></tr>';
  }

  async function loadLowStock() {
    const list = document.getElementById('lowStock');
    let q = sb.from('shop_products')
      .select('id,name,stock,status,shop_stores(name)')
      .lte('stock', 5).order('stock').limit(8);
    if (filter.value) q = q.eq('store_id', filter.value);
    const { data, error } = await q;
    if (error) { list.innerHTML = `<li>${escapeHtml(translateError(error))}</li>`; return; }
    list.innerHTML = data.length ? data.map(p => `
      <li><span>${escapeHtml(p.name)} <small class="muted">· ${escapeHtml(p.shop_stores?.name || '')}${p.status === 'active' ? '' : ' (ปิดขาย)'}</small></span>
          <span class="stock-pill ${p.stock === 0 ? 'out' : 'low'}">${p.stock === 0 ? 'หมด' : `เหลือ ${p.stock}`}</span></li>`).join('')
      : '<li class="muted">สินค้าทุกรายการมีสต็อกเพียงพอ 👍</li>';
  }

  const reloadAll = () => Promise.all([loadStats(), loadRecent(), loadLowStock()]);
  filter.addEventListener('change', reloadAll);
  await reloadAll();
  subscribeNewOrders(reloadAll);
}

/* =====================================================================
   STORES (จัดการร้านค้า)
   ===================================================================== */

async function initStores() {
  const grid = document.getElementById('storeList');
  const dialog = document.getElementById('storeDialog');
  const form = document.getElementById('storeForm');
  const preview = document.getElementById('storeImagePreview');
  const fileInput = form.image;
  const saveBtn = document.getElementById('saveStoreBtn');
  let stores = [];
  let counts = {};
  let editing = null;

  async function load() {
    try {
      const [list, prods] = await Promise.all([
        fetchStores(),
        sb.from('shop_products').select('store_id')
      ]);
      if (prods.error) throw prods.error;
      stores = list;
      counts = {};
      prods.data.forEach(p => { counts[p.store_id] = (counts[p.store_id] || 0) + 1; });
      render();
    } catch (err) {
      grid.innerHTML = `<div class="notice notice-error">${escapeHtml(translateError(err))}</div>`;
    }
  }

  function render() {
    document.getElementById('storeCount').textContent =
      `ทั้งหมด ${stores.length} ร้าน · เปิดอยู่ ${stores.filter(s => s.status === 'open').length} ร้าน`;
    grid.innerHTML = stores.length ? stores.map(s => `
      <article class="admin-store-card" data-id="${escapeHtml(s.id)}">
        <img src="${safeImageUrl(s.image_url)}" alt="" loading="lazy">
        <div class="admin-store-body">
          <div class="store-title"><h3>${escapeHtml(s.name)}</h3>${storeStatusBadge(s.status)}</div>
          <p class="muted">${escapeHtml(s.description || 'ยังไม่มีคำอธิบาย')}</p>
          <p class="field-hint">สินค้า ${Number(counts[s.id] || 0).toLocaleString('th-TH')} รายการ</p>
          <div class="row-actions">
            <button type="button" class="btn btn-sm ${s.status === 'open' ? 'btn-ghost' : 'btn-primary'}" data-act="toggle">
              ${s.status === 'open' ? '⏸️ ปิดร้าน' : '▶️ เปิดร้าน'}</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="edit">✏️ แก้ไข</button>
            <a class="btn btn-sm btn-ghost" href="products.html?store=${encodeURIComponent(s.id)}">📦 สินค้า</a>
            <a class="btn btn-sm btn-ghost" href="../store.html?id=${encodeURIComponent(s.id)}" target="_blank" rel="noopener">👁️ ดูหน้าร้าน</a>
            <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete">🗑️ ลบ</button>
          </div>
        </div>
      </article>`).join('')
      : '<p class="muted center">ยังไม่มีร้านค้า — กด “➕ เพิ่มร้านค้า” เพื่อเริ่มต้น</p>';
  }

  function openForm(s = null) {
    editing = s;
    form.reset();
    document.getElementById('storeDialogTitle').textContent = s ? '✏️ แก้ไขร้านค้า' : '➕ เพิ่มร้านค้า';
    document.getElementById('storeFormError').hidden = true;
    form.store_name.value = s?.name || '';
    form.description.value = s?.description || '';
    form.status.value = s?.status || 'open';
    preview.src = safeImageUrl(s?.image_url);
    document.getElementById('removeStoreImageWrap').hidden = !s?.image_url;
    document.getElementById('newStoreHint').hidden = !!s;
    dialog.showModal();
    form.store_name.focus();
  }

  fileInput.addEventListener('change', () => previewFile(fileInput, preview, editing?.image_url));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errBox = document.getElementById('storeFormError');
    const fail = m => { errBox.hidden = false; errBox.textContent = m; };
    errBox.hidden = true;

    const name = form.store_name.value.trim();
    if (!name) return fail('กรุณาตั้งชื่อร้าน');

    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';
    let uploadedPath = null;
    try {
      const payload = { name, description: form.description.value.trim(), status: form.status.value };
      const file = fileInput.files[0];
      if (file) {
        const up = await uploadImage(file, 'stores');
        uploadedPath = up.path;
        payload.image_url = up.url;
      } else if (editing && form.remove_image?.checked) {
        payload.image_url = null;
      }

      const res = editing
        ? await sb.from('shop_stores').update(payload).eq('id', editing.id).select()
        : await sb.from('shop_stores').insert({ ...payload, sort_order: stores.length + 1 }).select();
      if (res.error) throw res.error;

      if (editing?.image_url && 'image_url' in payload && payload.image_url !== editing.image_url) {
        removeImageByUrl(editing.image_url);
      }
      dialog.close();
      showToast(editing ? 'บันทึกร้านค้าแล้ว' : `เพิ่มร้าน "${name}" แล้ว — ตอนเพิ่มสินค้า เลือกหมวดหมู่เป็นร้านนี้ได้เลย`, 'success');
      await load();
    } catch (err) {
      if (uploadedPath) sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]);
      fail(translateError(err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'บันทึกร้านค้า';
    }
  });

  async function toggle(s, btn) {
    const next = s.status === 'open' ? 'closed' : 'open';
    btn.disabled = true;
    const { error } = await sb.from('shop_stores').update({ status: next }).eq('id', s.id);
    btn.disabled = false;
    if (error) { showToast(translateError(error), 'error'); return; }
    showToast(`${next === 'open' ? 'เปิด' : 'ปิด'}ร้าน "${s.name}" แล้ว`, 'success');
    load();
  }

  async function remove(s) {
    const n = counts[s.id] || 0;
    if (!confirm(`ยืนยันการลบร้าน "${s.name}" ?\n\n• สินค้า ${n} รายการและหมวดหมู่ของร้านนี้จะถูกลบด้วย\n• ประวัติคำสั่งซื้อเดิมยังเก็บไว้\n\nลบแล้วกู้คืนไม่ได้ — ถ้าแค่หยุดขายชั่วคราว แนะนำให้กด "ปิดร้าน" แทน`)) return;
    const { data: imgs } = await sb.from('shop_products').select('image_url').eq('store_id', s.id).not('image_url', 'is', null);
    const { error } = await sb.from('shop_stores').delete().eq('id', s.id);
    if (error) { showToast(translateError(error), 'error', 5000); return; }
    [s.image_url, ...(imgs || []).map(p => p.image_url)].filter(Boolean).forEach(removeImageByUrl);
    showToast(`ลบร้าน "${s.name}" แล้ว`, 'success');
    load();
  }

  grid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const s = stores.find(x => x.id === btn.closest('[data-id]').dataset.id);
    if (!s) return;
    if (btn.dataset.act === 'toggle') toggle(s, btn);
    if (btn.dataset.act === 'edit') openForm(s);
    if (btn.dataset.act === 'delete') remove(s);
  });
  document.getElementById('addStoreBtn').addEventListener('click', () => openForm());
  document.getElementById('cancelStoreDialog').addEventListener('click', () => dialog.close());

  await load();
  if (new URLSearchParams(location.search).get('new') === '1') openForm();
}

/* =====================================================================
   PRODUCTS (จัดการสินค้า) — ร้านค้า = หมวดหมู่ของสินค้า
   ===================================================================== */

async function initProducts() {
  const filter = document.getElementById('productStore');
  const tbody = document.getElementById('productTable');
  const search = document.getElementById('productSearch');
  const dialog = document.getElementById('productDialog');
  const form = document.getElementById('productForm');
  const preview = document.getElementById('imagePreview');
  const fileInput = form.image;
  const saveBtn = document.getElementById('saveProductBtn');
  const addBtn = document.getElementById('addProductBtn');
  let products = [];
  let editing = null;

  const stores = await fetchStores();
  if (!stores.length) {
    filter.disabled = true;
    addBtn.disabled = true;
    tbody.innerHTML = noStoresHtml(5);
    document.getElementById('productCount').textContent = '';
    return;
  }
  fillStoreSelect(filter, stores, { allowAll: true });
  filter.querySelector('option[value=""]').textContent = 'ทุกหมวดหมู่ (ทุกร้าน)';
  form.store_id.innerHTML = stores.map(s =>
    `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.status === 'open' ? '' : ' (ปิดอยู่)'}</option>`).join('');

  const storeName = id => stores.find(s => s.id === id)?.name || '';

  async function load() {
    let q = sb.from('shop_products').select('*').order('created_at', { ascending: false });
    if (filter.value) q = q.eq('store_id', filter.value);
    const { data, error } = await q;
    if (error) { tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(translateError(error))}</td></tr>`; return; }
    products = data || [];
    render();
  }

  function statusOf(p) {
    if (p.status !== 'active') return '<span class="status-badge st-cancelled">ปิดการขาย</span>';
    if (p.stock <= 0) return '<span class="status-badge st-out">สินค้าหมด</span>';
    return '<span class="status-badge st-completed">พร้อมขาย</span>';
  }

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    const list = products.filter(p => !q || (p.name + ' ' + storeName(p.store_id)).toLowerCase().includes(q));
    document.getElementById('productCount').textContent = `ทั้งหมด ${list.length} รายการ`;
    tbody.innerHTML = list.length ? list.map(p => `
      <tr data-id="${escapeHtml(p.id)}">
        <td data-label="สินค้า">
          <div class="prod-cell">
            <img src="${safeImageUrl(p.image_url)}" alt="" loading="lazy">
            <div><strong>${escapeHtml(p.name)}</strong><small>🏪 ${escapeHtml(storeName(p.store_id))}</small></div>
          </div>
        </td>
        <td data-label="ราคา" class="num">${formatPrice(p.price)}</td>
        <td data-label="Stock">
          <div class="stock-edit">
            <label class="sr-only" for="stk-${escapeHtml(p.id)}">จำนวนคงเหลือ</label>
            <input type="number" min="0" step="1" inputmode="numeric" id="stk-${escapeHtml(p.id)}"
                   value="${p.stock}" data-original="${p.stock}" aria-label="จำนวนคงเหลือ">
            <button type="button" class="btn btn-sm btn-secondary" data-act="stock">อัปเดต</button>
          </div>
        </td>
        <td data-label="สถานะ">${statusOf(p)}</td>
        <td data-label="จัดการ">
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-act="edit">✏️ แก้ไข</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete">🗑️ ลบ</button>
          </div>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="5" class="muted center">ยังไม่มีสินค้า — กด “➕ เพิ่มสินค้า” เพื่อเริ่มต้น</td></tr>';
  }

  /* ----- อัปเดต Stock (กันเขียนทับกรณีมีลูกค้าสั่งซื้อระหว่างนั้น) ----- */
  async function updateStock(row, btn) {
    const id = row.dataset.id;
    const input = row.querySelector('.stock-edit input');
    const original = parseInt(input.dataset.original, 10);
    const value = parseInt(input.value, 10);
    if (!Number.isInteger(value) || value < 0) { showToast('จำนวนคงเหลือต้องเป็นจำนวนเต็ม 0 ขึ้นไป', 'warn'); return; }
    if (value === original) { showToast('จำนวนไม่เปลี่ยนแปลง'); return; }

    btn.disabled = true;
    const { data, error } = await sb.from('shop_products')
      .update({ stock: value }).eq('id', id).eq('stock', original).select();
    btn.disabled = false;

    if (error) { showToast(translateError(error), 'error'); return; }
    if (!data || !data.length) {
      showToast('สต็อกมีการเปลี่ยนแปลงระหว่างนี้ (อาจมีลูกค้าสั่งซื้อ) โหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบอีกครั้ง', 'warn', 5000);
      await load();
      return;
    }
    showToast(`อัปเดตจำนวนเป็น ${value} ชิ้นแล้ว`, 'success');
    await load();
  }

  /* ----- เพิ่ม / แก้ไข ----- */
  function openForm(p = null) {
    editing = p;
    form.reset();
    document.getElementById('dialogTitle').textContent = p ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้า';
    document.getElementById('formError').hidden = true;
    if (p) {
      form.product_name.value = p.name;
      form.description.value = p.description || '';
      form.price.value = p.price;
      form.stock.value = p.stock;
      form.store_id.value = p.store_id;
      form.status.value = p.status;
    } else {
      form.stock.value = 0;
      form.status.value = 'active';
      form.store_id.value = filter.value || stores[0].id;
    }
    preview.src = safeImageUrl(p?.image_url);
    document.getElementById('removeImageWrap').hidden = !p?.image_url;
    dialog.showModal();
    form.product_name.focus();
  }

  fileInput.addEventListener('change', () => previewFile(fileInput, preview, editing?.image_url));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errBox = document.getElementById('formError');
    const fail = m => { errBox.hidden = false; errBox.textContent = m; };
    errBox.hidden = true;

    const name = form.product_name.value.trim();
    const price = Number(form.price.value);
    const stock = Number(form.stock.value);
    if (!name) return fail('กรุณากรอกชื่อสินค้า');
    if (!form.store_id.value) return fail('กรุณาเลือกหมวดหมู่ (ร้านค้า)');
    if (form.price.value === '' || !Number.isFinite(price) || price < 0) return fail('ราคาต้องเป็นตัวเลข 0 ขึ้นไป');
    if (form.stock.value === '' || !Number.isInteger(stock) || stock < 0) return fail('จำนวนสินค้าต้องเป็นจำนวนเต็ม 0 ขึ้นไป');

    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';
    let uploadedPath = null;

    try {
      const payload = {
        name,
        description: form.description.value.trim(),
        price: Math.round(price * 100) / 100,
        store_id: form.store_id.value,
        category_id: null,
        status: form.status.value
      };

      const file = fileInput.files[0];
      if (file) {
        const up = await uploadImage(file, 'products');
        uploadedPath = up.path;
        payload.image_url = up.url;
      } else if (editing && form.remove_image?.checked) {
        payload.image_url = null;
      }

      let result;
      if (editing) {
        const stockChanged = stock !== editing.stock;
        let query = sb.from('shop_products').update(stockChanged ? { ...payload, stock } : payload).eq('id', editing.id);
        // ถ้าแก้สต็อก ต้องแน่ใจว่าไม่มีคำสั่งซื้อตัดสต็อกไปก่อนหน้า
        if (stockChanged) query = query.eq('stock', editing.stock);
        result = await query.select();
        if (!result.error && (!result.data || !result.data.length)) {
          throw new Error('สต็อกของสินค้านี้เปลี่ยนแปลงระหว่างที่คุณแก้ไข (อาจมีลูกค้าสั่งซื้อ) กรุณาเปิดฟอร์มใหม่');
        }
      } else {
        result = await sb.from('shop_products').insert({ ...payload, stock }).select();
      }
      if (result.error) throw result.error;

      if (editing?.image_url && 'image_url' in payload && payload.image_url !== editing.image_url) {
        removeImageByUrl(editing.image_url);
      }

      dialog.close();
      showToast(`${editing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มสินค้าแล้ว'} — อยู่ในร้าน "${storeName(payload.store_id)}"`, 'success');
      await load();
    } catch (err) {
      if (uploadedPath) sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]);
      fail(translateError(err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'บันทึกสินค้า';
    }
  });

  document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());
  addBtn.addEventListener('click', () => openForm());

  /* ----- ลบ ----- */
  async function deleteProduct(p) {
    if (!confirm(`ยืนยันการลบ "${p.name}" ?\n\n(ประวัติคำสั่งซื้อเดิมยังคงอยู่)\nหากแค่ต้องการหยุดขายชั่วคราว แนะนำให้ตั้งสถานะ "ปิดการขาย" แทน`)) return;
    const { error } = await sb.from('shop_products').delete().eq('id', p.id);
    if (error) { showToast(translateError(error), 'error'); return; }
    if (p.image_url) removeImageByUrl(p.image_url);
    showToast('ลบสินค้าแล้ว', 'success');
    await load();
  }

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('tr');
    const p = products.find(x => x.id === row.dataset.id);
    if (!p) return;
    if (btn.dataset.act === 'stock') updateStock(row, btn);
    if (btn.dataset.act === 'edit') openForm(p);
    if (btn.dataset.act === 'delete') deleteProduct(p);
  });
  tbody.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.stock-edit input')) {
      e.preventDefault();
      const row = e.target.closest('tr');
      updateStock(row, row.querySelector('[data-act="stock"]'));
    }
  });

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
  filter.addEventListener('change', () => { search.value = ''; load(); });

  await load();
}

/* ----- อัปโหลดรูป (ย่อขนาดอัตโนมัติ เพื่อให้โหลดเร็วบนมือถือ) ----- */

function previewFile(input, img, fallbackUrl) {
  const f = input.files[0];
  if (!f) { img.src = safeImageUrl(fallbackUrl); return; }
  if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
    showToast('รองรับไฟล์ JPG, PNG, WEBP, GIF เท่านั้น', 'warn');
    input.value = '';
    return;
  }
  img.src = URL.createObjectURL(f);
}

async function resizeImage(file, maxSize = 1200, quality = 0.85) {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 800 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

async function uploadImage(originalFile, folder) {
  if (originalFile.size > 10 * 1024 * 1024) throw new Error('ไฟล์รูปใหญ่เกินไป (สูงสุด 10MB ก่อนย่อ)');
  const file = await resizeImage(originalFile);
  if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์รูปใหญ่เกิน 5MB');
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type] || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000', upsert: false, contentType: file.type
  });
  if (error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function removeImageByUrl(url) {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const i = (url || '').indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  sb.storage.from(STORAGE_BUCKET).remove([path]).then(({ error }) => {
    if (error) console.warn('ลบรูปเก่าไม่สำเร็จ', error);
  });
}

/* =====================================================================
   ADDRESSES (ที่อยู่ / สถานที่รับสินค้า ที่ลูกค้าเลือกได้)
   ===================================================================== */

async function initAddresses() {
  const tbody = document.getElementById('addressTable');
  const form = document.getElementById('addressForm');
  const input = form.address_name;
  let list = [];

  async function load() {
    const { data, error } = await sb.from('shop_addresses').select('id,name,sort_order').order('sort_order').order('name');
    if (error) { tbody.innerHTML = `<tr><td colspan="2">${escapeHtml(translateError(error))}</td></tr>`; return; }
    list = data;
    render();
  }

  function render() {
    document.getElementById('addressCount').textContent = `ทั้งหมด ${list.length} แห่ง`;
    tbody.innerHTML = list.length ? list.map((a, i) => `
      <tr data-id="${escapeHtml(a.id)}">
        <td data-label="สถานที่"><strong>📍 ${escapeHtml(a.name)}</strong></td>
        <td data-label="จัดการ">
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-act="up" aria-label="เลื่อนขึ้น" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="down" aria-label="เลื่อนลง" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="edit">✏️ แก้ไข</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete">🗑️ ลบ</button>
          </div>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="2" class="muted center">ยังไม่มีที่อยู่ — ลูกค้าจะสั่งซื้อไม่ได้จนกว่าจะเพิ่มอย่างน้อย 1 แห่ง</td></tr>';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { showToast('กรุณากรอกชื่อสถานที่', 'warn'); input.focus(); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const maxOrder = list.reduce((m, a) => Math.max(m, a.sort_order), 0);
    const { error } = await sb.from('shop_addresses').insert({ name, sort_order: maxOrder + 1 });
    btn.disabled = false;
    if (error) { showToast(translateError(error), 'error'); return; }
    input.value = '';
    showToast(`เพิ่ม "${name}" แล้ว`, 'success');
    load();
  });

  async function rename(a) {
    const name = (prompt('ชื่อสถานที่ใหม่', a.name) || '').trim();
    if (!name || name === a.name) return;
    const { error } = await sb.from('shop_addresses').update({ name }).eq('id', a.id);
    if (error) { showToast(translateError(error), 'error'); return; }
    showToast(`เปลี่ยนชื่อเป็น "${name}" แล้ว`, 'success');
    load();
  }

  async function remove(a) {
    if (!confirm(`ลบ "${a.name}" ออกจากรายการที่อยู่ ?\n\nลูกค้าจะเลือกสถานที่นี้ไม่ได้อีก (คำสั่งซื้อเดิมไม่กระทบ)`)) return;
    const { error } = await sb.from('shop_addresses').delete().eq('id', a.id);
    if (error) { showToast(translateError(error), 'error'); return; }
    showToast(`ลบ "${a.name}" แล้ว`, 'success');
    load();
  }

  // สลับลำดับกับแถวข้างเคียง (จัดเลขใหม่ทั้งหมดเพื่อกันค่า sort_order ซ้ำ)
  async function move(a, dir) {
    const i = list.indexOf(a);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const changed = list.map((x, k) => ({ ...x, next: k + 1 })).filter(x => x.sort_order !== x.next);
    render();
    const results = await Promise.all(changed.map(x =>
      sb.from('shop_addresses').update({ sort_order: x.next }).eq('id', x.id)));
    const failed = results.find(r => r.error);
    if (failed) showToast(translateError(failed.error), 'error');
    load();
  }

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const a = list.find(x => x.id === btn.closest('tr').dataset.id);
    if (!a) return;
    if (btn.dataset.act === 'up') move(a, -1);
    if (btn.dataset.act === 'down') move(a, 1);
    if (btn.dataset.act === 'edit') rename(a);
    if (btn.dataset.act === 'delete') remove(a);
  });

  await load();
}

/* =====================================================================
   ORDERS (คำสั่งซื้อ)
   ===================================================================== */

async function initOrders() {
  const tbody = document.getElementById('orderTable');
  const search = document.getElementById('orderSearch');
  const storeFilter = document.getElementById('orderStore');
  const statusFilter = document.getElementById('statusFilter');
  const dialog = document.getElementById('orderDialog');
  const PAGE_SIZE = 50;
  let orders = [];
  let page = 0;

  fillStoreSelect(storeFilter, await fetchStores(), { allowAll: true });
  statusFilter.innerHTML = '<option value="">ทุกสถานะ</option>' +
    Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join('');

  function statusSelect(o) {
    return `<select class="status-select ${ORDER_STATUS[o.status]?.cls || ''}" data-act="status" aria-label="สถานะคำสั่งซื้อ">
      ${Object.entries(ORDER_STATUS).map(([k, v]) =>
        `<option value="${k}" ${k === o.status ? 'selected' : ''}>${escapeHtml(v.label)}</option>`).join('')}
    </select>`;
  }

  async function load(append = false) {
    if (!append) page = 0;
    let query = sb.from('shop_orders')
      .select('id,order_number,store_id,store_name,customer_name,customer_email,phone,address,note,total_amount,status,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const q = search.value.replace(/[,()%*\\"']/g, ' ').trim();
    if (q) query = query.or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,phone.ilike.%${q.replace(/[^0-9+]/g, '') || q}%`);
    if (storeFilter.value) query = query.eq('store_id', storeFilter.value);
    if (statusFilter.value) query = query.eq('status', statusFilter.value);

    const { data, error, count } = await query;
    if (error) { tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(translateError(error))}</td></tr>`; return; }

    orders = append ? orders.concat(data) : data;
    document.getElementById('orderCount').textContent = `พบ ${Number(count || 0).toLocaleString('th-TH')} รายการ`;
    document.getElementById('loadMore').hidden = orders.length >= (count || 0);
    render();
  }

  function render() {
    tbody.innerHTML = orders.length ? orders.map(o => `
      <tr data-id="${escapeHtml(o.id)}">
        <td data-label="เลข Order"><strong class="mono">${escapeHtml(o.order_number)}</strong></td>
        <td data-label="ร้านค้า">${escapeHtml(o.store_name)}</td>
        <td data-label="ชื่อลูกค้า">${escapeHtml(o.customer_name)}</td>
        <td data-label="เบอร์โทร"><a href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a></td>
        <td data-label="ยอดรวม" class="num">${formatPrice(o.total_amount)}</td>
        <td data-label="วันที่สั่ง">${formatDate(o.created_at)}</td>
        <td data-label="สถานะ">${statusSelect(o)}</td>
        <td data-label="">
          <div class="row-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-act="view">ดูรายละเอียด</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" data-act="delete">🗑️ ลบ</button>
          </div>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="8" class="muted center">ไม่พบคำสั่งซื้อ</td></tr>';
  }

  async function changeStatus(sel, order) {
    const next = sel.value;
    const prev = order.status;
    const label = ORDER_STATUS[next].label;
    let msg = `เปลี่ยนสถานะ ${order.order_number} เป็น "${label}" ?`;
    if (next === 'cancelled') msg += '\n\nระบบจะคืนสินค้าเข้าสต็อกอัตโนมัติ';
    if (prev === 'cancelled') msg += '\n\nระบบจะตัดสต็อกสินค้าอีกครั้ง';
    if (!confirm(msg)) { sel.value = prev; return; }

    sel.disabled = true;
    const { error } = await sb.rpc('shop_admin_update_order_status', { p_order_id: order.id, p_status: next });
    sel.disabled = false;
    if (error) {
      sel.value = prev;
      showToast(translateError(error), 'error', 5000);
      return;
    }
    order.status = next;
    sel.className = `status-select ${ORDER_STATUS[next].cls}`;
    showToast(`อัปเดตสถานะเป็น "${label}" แล้ว`, 'success');
  }

  async function viewOrder(order) {
    const body = document.getElementById('orderDetail');
    document.getElementById('orderDialogTitle').textContent = order.order_number;
    body.innerHTML = '<p class="muted">กำลังโหลด...</p>';
    dialog.showModal();

    const { data: items, error } = await sb.from('shop_order_items')
      .select('product_name,price,quantity,subtotal').eq('order_id', order.id);

    body.innerHTML = `
      <dl class="detail-list">
        <dt>ร้านค้า</dt><dd>${escapeHtml(order.store_name)}</dd>
        <dt>ลูกค้า</dt><dd>${escapeHtml(order.customer_name)}</dd>
        <dt>อีเมลผู้สั่ง</dt><dd>${escapeHtml(order.customer_email || '-')}</dd>
        <dt>เบอร์โทร</dt><dd><a href="tel:${escapeHtml(order.phone)}">${escapeHtml(order.phone)}</a></dd>
        <dt>ที่อยู่ / สถานที่รับ</dt><dd class="pre">${escapeHtml(order.address)}</dd>
        <dt>หมายเหตุ</dt><dd class="pre">${escapeHtml(order.note || '-')}</dd>
        <dt>วันที่สั่ง</dt><dd>${formatDate(order.created_at)}</dd>
        <dt>สถานะ</dt><dd>${statusBadge(order.status)}</dd>
      </dl>
      ${error ? `<p class="notice notice-error">${escapeHtml(translateError(error))}</p>` : `
      <table class="summary-table">
        <thead><tr><th>สินค้า</th><th class="num">ราคา</th><th class="num">จำนวน</th><th class="num">รวม</th></tr></thead>
        <tbody>${items.map(i => `
          <tr><td>${escapeHtml(i.product_name)}</td><td class="num">${formatPrice(i.price)}</td>
              <td class="num">${i.quantity}</td><td class="num">${formatPrice(i.subtotal)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="summary-total"><span>ยอดรวม</span><strong>${formatPrice(order.total_amount)}</strong></div>`}`;
  }

  /* ----- ลบ ----- */
  async function deleteOrder(order, btn) {
    // ออเดอร์ที่ยังไม่ยกเลิก/ไม่เสร็จสิ้น ต้องยกเลิกก่อนเพื่อคืนสต็อก
    const needRestock = order.status !== 'cancelled' && order.status !== 'completed';
    let msg = `ยืนยันการลบคำสั่งซื้อ ${order.order_number} ?\n\nลบแล้วกู้คืนไม่ได้`;
    if (needRestock) msg += '\nระบบจะคืนสินค้าเข้าสต็อกให้ก่อนลบ';
    if (!confirm(msg)) return;

    btn.disabled = true;
    if (needRestock) {
      const { error } = await sb.rpc('shop_admin_update_order_status', { p_order_id: order.id, p_status: 'cancelled' });
      if (error) { btn.disabled = false; showToast(translateError(error), 'error', 5000); return; }
    }
    const { error } = await sb.from('shop_orders').delete().eq('id', order.id);
    if (error) { btn.disabled = false; showToast(translateError(error), 'error', 5000); return load(); }
    showToast(`ลบคำสั่งซื้อ ${order.order_number} แล้ว`, 'success');
    load();
  }

  tbody.addEventListener('change', e => {
    if (e.target.dataset.act !== 'status') return;
    const order = orders.find(o => o.id === e.target.closest('tr').dataset.id);
    if (order) changeStatus(e.target, order);
  });
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName !== 'BUTTON') return;
    const order = orders.find(o => o.id === btn.closest('tr').dataset.id);
    if (!order) return;
    if (btn.dataset.act === 'view') viewOrder(order);
    if (btn.dataset.act === 'delete') deleteOrder(order, btn);
  });
  document.getElementById('closeOrderDialog').addEventListener('click', () => dialog.close());
  document.getElementById('loadMore').addEventListener('click', () => { page++; load(true); });

  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load(), 300); });
  storeFilter.addEventListener('change', () => load());
  statusFilter.addEventListener('change', () => load());

  await load();
  subscribeNewOrders(() => load());
}

/* =====================================================================
   BOOT
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  initShell();
  if (!(await Admin.requireAdmin())) return;
  OrderAlert.start();

  try {
    if (page === 'dashboard') await initDashboard();
    if (page === 'stores') await initStores();
    if (page === 'products') await initProducts();
    if (page === 'orders') await initOrders();
    if (page === 'addresses') await initAddresses();
  } catch (err) {
    console.error(err);
    showToast(translateError(err), 'error', 5000);
  }
});

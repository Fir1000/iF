/* =====================================================================
   cart.js — ตะกร้าสินค้า (เก็บใน localStorage) + หน้า cart.html
   ตะกร้าหนึ่งใบมีสินค้าได้จากร้านเดียว เพราะคำสั่งซื้อหนึ่งรายการผูกกับร้านเดียว
   ===================================================================== */

const CART_KEY = 'if_cart_v2';

const Cart = {
  // { store: { id, name } | null, items: [{ id, name, price, image_url, stock, quantity }] }
  read() {
    try {
      const data = JSON.parse(localStorage.getItem(CART_KEY));
      if (data && Array.isArray(data.items)) {
        const items = data.items.filter(i => i && i.id && i.quantity > 0);
        return { store: items.length && data.store && data.store.id ? data.store : null, items };
      }
    } catch { /* ข้อมูลเสีย -> เริ่มใหม่ */ }
    return { store: null, items: [] };
  },

  write(data) {
    if (!data.items.length) data.store = null;
    try { localStorage.setItem(CART_KEY, JSON.stringify(data)); } catch { /* storage ไม่พร้อม */ }
    updateCartUI();
  },

  get() { return this.read().items; },
  store() { return this.read().store; },
  count() { return this.get().reduce((s, i) => s + i.quantity, 0); },
  total() { return this.get().reduce((s, i) => s + Number(i.price) * i.quantity, 0); },
  qtyOf(id) { const it = this.get().find(i => i.id === id); return it ? it.quantity : 0; },

  // คืน { ok } หรือ { ok:false, msg } หรือ { ok:false, conflict:true, storeName } เมื่อตะกร้ามีของร้านอื่นอยู่
  add(product, qty, store) {
    qty = parseInt(qty, 10) || 1;
    const data = this.read();
    if (data.store && data.store.id !== store.id) {
      return { ok: false, conflict: true, storeName: data.store.name };
    }
    const existing = data.items.find(i => i.id === product.id);
    const current = existing ? existing.quantity : 0;
    const stock = Number(product.stock);

    if (stock <= 0) return { ok: false, msg: 'สินค้าหมด' };
    if (current + qty > stock) {
      const left = stock - current;
      return { ok: false, msg: left > 0 ? `เพิ่มได้อีกไม่เกิน ${left} ชิ้น` : `มีในตะกร้าครบจำนวนคงเหลือแล้ว (${stock} ชิ้น)` };
    }

    const item = {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url || '',
      stock,
      quantity: current + qty
    };
    if (existing) Object.assign(existing, item); else data.items.push(item);
    data.store = { id: store.id, name: store.name };
    this.write(data);
    return { ok: true };
  },

  setQty(id, qty) {
    const data = this.read();
    const it = data.items.find(i => i.id === id);
    if (!it) return;
    qty = parseInt(qty, 10) || 0;
    if (qty <= 0) return this.remove(id);
    it.quantity = Math.min(qty, it.stock || qty);
    this.write(data);
  },

  remove(id) {
    const data = this.read();
    data.items = data.items.filter(i => i.id !== id);
    this.write(data);
  },

  clear() { this.write({ store: null, items: [] }); },

  // อัปเดตราคา/สต็อกในตะกร้าจากรายการสินค้าที่โหลดมาแล้ว (ไม่ลบรายการ)
  syncFromList(products) {
    const map = new Map(products.map(p => [p.id, p]));
    const data = this.read();
    let changed = false;
    data.items.forEach(it => {
      const p = map.get(it.id);
      if (!p) return;
      if (it.price !== Number(p.price) || it.stock !== p.stock || it.name !== p.name) {
        it.price = Number(p.price); it.stock = p.stock; it.name = p.name; it.image_url = p.image_url || '';
        changed = true;
      }
    });
    if (changed) this.write(data);
  },

  // ดึงข้อมูลล่าสุดจากฐานข้อมูล: ปรับราคา/จำนวน ลบสินค้าที่หมด/ปิดขาย และเช็กว่าร้านยังเปิดอยู่
  async refresh() {
    const data = this.read();
    if (!data.items.length || !isConfigured()) return { notes: [], storeOpen: true };

    const [prod, store] = await Promise.all([
      sb.from('shop_products').select('id,store_id,name,price,stock,image_url,status').in('id', data.items.map(i => i.id)),
      sb.from('shop_stores').select('id,name,status').eq('id', data.store.id).maybeSingle()
    ]);
    if (prod.error) throw prod.error;
    if (store.error) throw store.error;

    const notes = [];
    if (!store.data) {
      this.clear();
      return { notes: ['ร้านค้านี้ถูกลบออกจากระบบแล้ว จึงล้างตะกร้าให้'], storeOpen: false };
    }

    const map = new Map((prod.data || []).map(p => [p.id, p]));
    const next = [];
    for (const it of data.items) {
      const p = map.get(it.id);
      if (!p || p.status !== 'active' || p.store_id !== data.store.id) { notes.push(`"${it.name}" ปิดการขายแล้ว จึงถูกนำออกจากตะกร้า`); continue; }
      if (p.stock <= 0) { notes.push(`"${p.name}" สินค้าหมด จึงถูกนำออกจากตะกร้า`); continue; }
      let q = it.quantity;
      if (q > p.stock) {
        q = p.stock;
        notes.push(`"${p.name}" เหลือ ${p.stock} ชิ้น ปรับจำนวนในตะกร้าให้แล้ว`);
      }
      if (Number(p.price) !== Number(it.price)) notes.push(`ราคา "${p.name}" เปลี่ยนเป็น ${formatPrice(p.price)}`);
      next.push({ id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url || '', stock: p.stock, quantity: q });
    }
    const storeOpen = store.data.status === 'open';
    if (!storeOpen) notes.push(`ร้าน "${store.data.name}" ปิดอยู่ตอนนี้ ยังสั่งซื้อไม่ได้`);
    this.write({ store: { id: store.data.id, name: store.data.name }, items: next });
    return { notes, storeOpen };
  }
};

/* ---------- เพิ่มลงตะกร้า (ใช้ร่วมกับหน้าร้าน) ---------- */

function addToCartWithPrompt(product, qty, store) {
  let res = Cart.add(product, qty, store);
  if (res.conflict) {
    if (!confirm(t('ตะกร้ามีสินค้าจากร้าน "{a}" อยู่\n\nสั่งได้ครั้งละ 1 ร้าน — ล้างตะกร้าเดิมแล้วเริ่มสั่งจากร้าน "{b}" ?',
      { a: res.storeName, b: store.name }))) {
      return { ok: false, cancelled: true };
    }
    Cart.clear();
    res = Cart.add(product, qty, store);
  }
  return res;
}

/* ---------- Badge + แถบตะกร้าลอย ---------- */

function updateCartUI() {
  const count = Cart.count();
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count > 99 ? '99+' : String(count);
    el.hidden = count === 0;
  });

  const sticky = document.getElementById('stickyCart');
  if (sticky) {
    sticky.hidden = count === 0;
    document.body.classList.toggle('has-sticky-cart', count > 0);
    const c = sticky.querySelector('[data-sticky-count]');
    const t = sticky.querySelector('[data-sticky-total]');
    const s = sticky.querySelector('[data-sticky-store]');
    if (c) c.textContent = `${count} ชิ้น`;
    if (t) t.textContent = formatPrice(Cart.total());
    if (s) s.textContent = Cart.store()?.name || '';
  }
}

window.addEventListener('storage', e => {
  if (e.key === CART_KEY) {
    updateCartUI();
    if (document.getElementById('cartPage')) renderCartPage();
  }
});

/* ---------- หน้า cart.html ---------- */

let cartStoreOpen = true;

function renderCartPage(notes = []) {
  const itemsEl = document.getElementById('cartItems');
  const summaryEl = document.getElementById('cartSummary');
  const notesEl = document.getElementById('cartNotes');
  const storeEl = document.getElementById('cartStore');
  if (!itemsEl) return;

  notesEl.innerHTML = notes.length
    ? `<div class="notice notice-warn"><ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
    : '';

  const { store, items } = Cart.read();
  if (!items.length) {
    storeEl.hidden = true;
    itemsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <h2>ตะกร้าของคุณยังว่าง</h2>
        <p>เลือกร้านที่ชอบ แล้วเลือกสินค้าได้เลย</p>
        <a href="index.html#stores" class="btn btn-primary">เลือกร้านค้า</a>
      </div>`;
    summaryEl.hidden = true;
    return;
  }

  storeEl.hidden = false;
  storeEl.innerHTML = `🏪 สั่งจากร้าน <strong>${escapeHtml(store.name)}</strong>
    <a href="store.html?id=${encodeURIComponent(store.id)}" class="btn-link">เลือกสินค้าเพิ่ม</a>`;

  itemsEl.innerHTML = items.map(it => `
    <article class="cart-item" data-id="${escapeHtml(it.id)}">
      <img src="${safeImageUrl(it.image_url)}" alt="${escapeHtml(it.name)}" loading="lazy">
      <div class="cart-item-body">
        <h3>${escapeHtml(it.name)}</h3>
        <p class="cart-item-calc">${formatPrice(it.price)} × ${it.quantity}</p>
        <p class="cart-item-stock">คงเหลือ ${it.stock} ชิ้น</p>
        <div class="cart-item-actions">
          <div class="qty-stepper" role="group" aria-label="จำนวน">
            <button type="button" data-act="dec" aria-label="ลดจำนวน">−</button>
            <input type="number" inputmode="numeric" min="1" max="${it.stock}" value="${it.quantity}" data-act="qty" aria-label="จำนวน">
            <button type="button" data-act="inc" aria-label="เพิ่มจำนวน" ${it.quantity >= it.stock ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn-link danger" data-act="remove">ลบ</button>
        </div>
      </div>
      <div class="cart-item-subtotal">= ${formatPrice(it.price * it.quantity)}</div>
    </article>`).join('');

  summaryEl.hidden = false;
  summaryEl.innerHTML = `
    <h2>สรุปคำสั่งซื้อ</h2>
    <p class="summary-store">ร้านค้า: <strong>${escapeHtml(store.name)}</strong></p>
    <ul class="summary-lines">
      ${items.map(it => `
        <li><span>${escapeHtml(it.name)}<small>${formatPrice(it.price)} × ${it.quantity}</small></span>
            <strong>${formatPrice(it.price * it.quantity)}</strong></li>`).join('')}
    </ul>
    <div class="summary-total"><span>ยอดรวมทั้งหมด</span><strong>${formatPrice(Cart.total())}</strong></div>
    ${cartStoreOpen
      ? '<a href="checkout.html" class="btn btn-primary btn-block btn-lg">สั่งซื้อ</a>'
      : '<button type="button" class="btn btn-primary btn-block btn-lg" disabled>ร้านปิดอยู่</button>'}
    <a href="store.html?id=${encodeURIComponent(store.id)}" class="btn btn-ghost btn-block">เลือกสินค้าต่อ</a>`;
}

async function initCartPage() {
  const page = document.getElementById('cartPage');
  if (!page) return;

  renderCartPage();
  try {
    const { notes, storeOpen } = await Cart.refresh();
    cartStoreOpen = storeOpen;
    renderCartPage(notes);
  } catch (err) {
    console.error(err);
  }

  const itemsEl = document.getElementById('cartItems');
  itemsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const id = btn.closest('.cart-item').dataset.id;
    const qty = Cart.qtyOf(id);
    if (btn.dataset.act === 'inc') Cart.setQty(id, qty + 1);
    if (btn.dataset.act === 'dec') Cart.setQty(id, qty - 1);
    if (btn.dataset.act === 'remove') { Cart.remove(id); showToast('ลบสินค้าออกจากตะกร้าแล้ว'); }
    renderCartPage();
  });
  itemsEl.addEventListener('change', e => {
    if (e.target.dataset.act !== 'qty') return;
    const id = e.target.closest('.cart-item').dataset.id;
    const it = Cart.get().find(i => i.id === id);
    let v = parseInt(e.target.value, 10) || 1;
    if (it && v > it.stock) { v = it.stock; showToast(`สินค้าเหลือ ${it.stock} ชิ้น`, 'warn'); }
    Cart.setQty(id, Math.max(1, v));
    renderCartPage();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  initCartPage();
});

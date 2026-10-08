/* =====================================================================
   store.js — หน้าภายในร้านค้า (store.html?id=...)
   ส่วนหัวร้าน, ค้นหา, การ์ดสินค้า, เพิ่มลงตะกร้า (ร้านค้า = หมวดหมู่ของสินค้า)
   ===================================================================== */

(function () {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const params = new URLSearchParams(location.search);
  const storeId = params.get('id');
  const state = {
    store: null,
    products: [],
    q: ''
  };

  const headEl = document.getElementById('storeHead');
  const searchInput = document.getElementById('productSearch');
  const countEl = document.getElementById('resultCount');

  function notFound(msg) {
    headEl.innerHTML = '';
    document.getElementById('shopTools').hidden = true;
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏪</div>
      <h2>${escapeHtml(msg)}</h2><p>ร้านนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
      <a href="index.html#stores" class="btn btn-primary">ดูร้านค้าทั้งหมด</a></div>`;
  }

  /* ---------- Load ---------- */

  async function loadStore() {
    const { data, error } = await sb.from('shop_stores')
      .select('id,name,description,image_url,status').eq('id', storeId).maybeSingle();
    if (error) throw error;
    state.store = data;
    return !!data;
  }

  async function loadProducts() {
    const { data, error } = await sb.from('shop_products')
      .select('id,store_id,name,description,price,stock,image_url,status,created_at')
      .eq('store_id', storeId).eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    state.products = data || [];
    Cart.syncFromList(state.products);
  }

  async function load() {
    try {
      if (!(await loadStore())) { notFound('ไม่พบร้านค้านี้'); return; }
      await loadProducts();
      renderHead();
      render();
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="notice notice-error">โหลดร้านค้าไม่สำเร็จ: ${escapeHtml(translateError(err))}
        <br><button class="btn btn-ghost btn-sm" type="button" id="retryLoad">ลองใหม่</button></div>`;
      document.getElementById('retryLoad')?.addEventListener('click', load);
    }
  }

  /* ---------- Render ---------- */

  function renderHead() {
    const s = state.store;
    document.title = `${s.name} | iF`;
    document.getElementById('crumbStore').textContent = s.name;
    headEl.innerHTML = `
      <div class="store-hero ${s.status === 'open' ? '' : 'is-closed'}">
        <img src="${safeImageUrl(s.image_url)}" alt="รูปร้าน ${escapeHtml(s.name)}">
        <div>
          <h1>${escapeHtml(s.name)}</h1>
          ${storeStatusBadge(s.status)}
          ${s.description ? `<p class="pre">${escapeHtml(s.description)}</p>` : ''}
        </div>
      </div>
      ${s.status === 'open' ? '' : '<div class="notice notice-warn">ร้านนี้ปิดอยู่ตอนนี้ ดูสินค้าได้ แต่ยังสั่งซื้อไม่ได้</div>'}`;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return state.products.filter(p => !q || (p.name + ' ' + (p.description || '')).toLowerCase().includes(q));
  }

  function cardHtml(p) {
    const stock = Number(p.stock);
    const closed = state.store.status !== 'open';
    const out = stock <= 0;
    const inCart = Cart.store()?.id === state.store.id ? Cart.qtyOf(p.id) : 0;
    const canAdd = Math.max(0, stock - inCart);
    const low = !out && stock <= 5;
    const blocked = closed || out || canAdd === 0;

    return `
      <article class="product-card ${out ? 'is-out' : ''}" data-id="${escapeHtml(p.id)}">
        <div class="product-media">
          <img src="${safeImageUrl(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">
          ${out ? '<span class="soldout-ribbon">สินค้าหมด</span>' : ''}
        </div>
        <div class="product-body">
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ''}
          <div class="product-meta">
            <span class="product-price">${formatPrice(p.price)}</span>
            <span class="stock-tag ${out ? 'stock-out' : low ? 'stock-low' : 'stock-ok'}">
              ${out ? 'สินค้าหมด' : `คงเหลือ ${stock} ชิ้น`}
            </span>
          </div>
          ${inCart ? `<p class="in-cart-note">✓ อยู่ในตะกร้า ${inCart} ชิ้น</p>` : ''}
          <div class="product-actions">
            <div class="qty-stepper" role="group" aria-label="เลือกจำนวน">
              <button type="button" data-act="dec" aria-label="ลดจำนวน" disabled>−</button>
              <input type="number" inputmode="numeric" min="1" max="${Math.max(1, canAdd)}" value="1"
                     data-act="qty" aria-label="จำนวน" ${blocked ? 'disabled' : ''}>
              <button type="button" data-act="inc" aria-label="เพิ่มจำนวน" ${blocked || canAdd <= 1 ? 'disabled' : ''}>+</button>
            </div>
            <button type="button" class="btn btn-primary btn-add" data-act="add" ${blocked ? 'disabled' : ''}>
              ${closed ? 'ร้านปิดอยู่' : out ? 'สินค้าหมด' : canAdd === 0 ? 'ครบจำนวนแล้ว' : '🛒 เพิ่มลงตะกร้า'}
            </button>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const list = filtered();
    countEl.textContent = `พบสินค้า ${list.length} รายการ`;
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : `<div class="empty-state"><div class="empty-icon">🍽️</div>
           <h2>${state.products.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ร้านนี้ยังไม่มีสินค้า'}</h2>
           <p>${state.products.length ? 'ลองเปลี่ยนคำค้นหาหรือหมวดหมู่' : 'กรุณากลับมาใหม่เร็ว ๆ นี้'}</p></div>`;
  }

  /* ---------- Events ---------- */

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const card = btn.closest('.product-card');
    const product = state.products.find(p => p.id === card.dataset.id);
    if (!product) return;
    const input = card.querySelector('input[data-act="qty"]');
    const max = parseInt(input.max, 10) || 1;
    let v = parseInt(input.value, 10) || 1;

    if (btn.dataset.act === 'inc' || btn.dataset.act === 'dec') {
      v = btn.dataset.act === 'inc' ? Math.min(max, v + 1) : Math.max(1, v - 1);
      input.value = v;
      card.querySelector('[data-act="dec"]').disabled = v <= 1;
      card.querySelector('[data-act="inc"]').disabled = v >= max;
      return;
    }

    if (btn.dataset.act === 'add') {
      const res = addToCartWithPrompt(product, v, state.store);
      if (res.ok) {
        showToast(`เพิ่ม "${product.name}" ${v} ชิ้นลงตะกร้าแล้ว`, 'success');
        render();
      } else if (!res.cancelled) {
        showToast(res.msg, 'warn');
      }
    }
  });

  grid.addEventListener('change', e => {
    if (e.target.dataset.act !== 'qty') return;
    const input = e.target;
    const card = input.closest('.product-card');
    const max = parseInt(input.max, 10) || 1;
    let v = parseInt(input.value, 10) || 1;
    if (v > max) { v = max; showToast(`เลือกได้สูงสุด ${max} ชิ้น`, 'warn'); }
    input.value = Math.max(1, v);
    card.querySelector('[data-act="dec"]').disabled = input.value <= 1;
    card.querySelector('[data-act="inc"]').disabled = input.value >= max;
  });

  let t;
  searchInput.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = searchInput.value; render(); }, 150);
  });

  /* ---------- Boot + Realtime ---------- */

  if (!isConfigured()) { grid.innerHTML = configNoticeHtml(); return; }
  if (!isUuid(storeId)) { notFound('ไม่พบร้านค้า'); return; }

  load();

  // ราคา/สต็อก หรือสถานะร้านเปลี่ยน -> อัปเดตหน้าเว็บทันที
  let rt;
  const reload = () => { clearTimeout(rt); rt = setTimeout(load, 400); };
  sb.channel('store-' + storeId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_products', filter: `store_id=eq.${storeId}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_stores', filter: `id=eq.${storeId}` }, reload)
    .subscribe();

  // โหลดใหม่เมื่อกลับมาที่แท็บ (กรณี realtime หลุด)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.store) load();
  });
})();

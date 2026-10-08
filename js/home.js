/* =====================================================================
   home.js — หน้าแรก: รายการร้านค้าทั้งหมด (index.html)
   ===================================================================== */

(function () {
  const grid = document.getElementById('storeGrid');
  if (!grid) return;

  let stores = [];
  let isAdmin = false;

  function cardHtml(s) {
    const open = s.status === 'open';
    return `
      <article class="store-card ${open ? '' : 'is-closed'}">
        <a class="store-media" href="store.html?id=${encodeURIComponent(s.id)}" tabindex="-1" aria-hidden="true">
          <img src="${safeImageUrl(s.image_url)}" alt="" loading="lazy">
        </a>
        <div class="store-body">
          <div class="store-title">
            <h3>${escapeHtml(s.name)}</h3>
            ${storeStatusBadge(s.status)}
          </div>
          ${s.description ? `<p class="store-desc">${escapeHtml(s.description)}</p>` : ''}
          <a href="store.html?id=${encodeURIComponent(s.id)}" class="btn ${open ? 'btn-primary' : 'btn-ghost'} btn-block">
            ${open ? 'เข้าร้านค้า' : 'เข้าร้านค้า (ปิดอยู่)'}
          </a>
        </div>
      </article>`;
  }

  // การ์ด "เพิ่มร้านค้า" แสดงเฉพาะผู้ดูแลระบบ
  const addCardHtml = `
    <a class="store-card store-add" href="admin/stores.html?new=1">
      <span class="store-add-icon">＋</span>
      <strong>เพิ่มร้านค้า</strong>
      <small>ผู้ดูแลระบบ</small>
    </a>`;

  function render() {
    if (!stores.length && !isAdmin) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏪</div>
        <h2>ยังไม่มีร้านค้า</h2><p>กรุณากลับมาใหม่เร็ว ๆ นี้</p></div>`;
      return;
    }
    grid.innerHTML = stores.map(cardHtml).join('') + (isAdmin ? addCardHtml : '');
  }

  async function load() {
    if (!isConfigured()) { grid.innerHTML = configNoticeHtml(); return; }
    const { data, error } = await sb.from('shop_stores')
      .select('id,name,description,image_url,status')
      .order('sort_order').order('created_at');
    if (error) {
      console.error(error);
      grid.innerHTML = `<div class="notice notice-error">โหลดร้านค้าไม่สำเร็จ: ${escapeHtml(translateError(error))}
        <br><button class="btn btn-ghost btn-sm" type="button" id="retryLoad">ลองใหม่</button></div>`;
      document.getElementById('retryLoad')?.addEventListener('click', load);
      return;
    }
    // ร้านที่เปิดอยู่ขึ้นก่อน
    stores = (data || []).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
    render();
  }

  (async () => {
    if (isConfigured() && await Auth.session().catch(() => null)) isAdmin = await Auth.isAdmin();
    await load();
  })();

  // ร้านเปิด/ปิด หรือเพิ่มร้านใหม่ -> อัปเดตทันที
  if (isConfigured()) {
    let t;
    sb.channel('public-stores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_stores' }, () => {
        clearTimeout(t);
        t = setTimeout(load, 400);
      })
      .subscribe();
  }
})();

/* =====================================================================
   checkout.js — กรอกข้อมูล -> สร้างคำสั่งซื้อ -> สแกน QR จ่ายเงิน -> รอ Admin ยืนยัน
   ขั้นตอน:
     1) ยืนยันการสั่งซื้อ  = สร้างออเดอร์ (ตัดสต็อก) สถานะชำระเงิน "unpaid"
     2) หน้า QR          = บันทึก QR / ย้อนกลับ (ยกเลิกออเดอร์ คืนสต็อก) / จ่ายแล้วเรียบร้อย
     3) จ่ายแล้วเรียบร้อย = สถานะชำระเงิน "waiting" -> หน้ารอยืนยันออเดอร์ (เพจ / LINE)
     4) Admin ตรวจยอดโอนแล้วกด "ยืนยันออเดอร์" ในหลังร้าน
   ลิงก์ checkout.html?pay=<order id> = กลับมาหน้าจ่ายเงินของออเดอร์เดิม (เช่น รีเฟรช / จากคำสั่งซื้อของฉัน)
   ===================================================================== */

(function () {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  const summaryEl = document.getElementById('orderSummary');
  const notesEl = document.getElementById('checkoutNotes');
  const errorEl = document.getElementById('checkoutError');
  const submitBtn = document.getElementById('submitOrder');
  const checkoutView = document.getElementById('checkoutView');
  const payView = document.getElementById('payView');
  const successView = document.getElementById('successView');
  let submitting = false;
  let storeOpen = true;
  let order = null;      // ออเดอร์ที่กำลังจ่าย
  let qrUrl = '';

  function renderSummary() {
    const { store, items } = Cart.read();
    if (!items.length) {
      checkoutView.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h2>ยังไม่มีสินค้าในตะกร้า</h2>
          <p>กรุณาเลือกสินค้าก่อนดำเนินการสั่งซื้อ</p>
          <a href="index.html#stores" class="btn btn-primary">เลือกร้านค้า</a>
        </div>`;
      return false;
    }
    summaryEl.innerHTML = `
      <h2>สรุปรายการก่อนยืนยัน</h2>
      <p class="summary-label">ร้านค้า:</p>
      <p class="summary-store-name">🏪 ${escapeHtml(store.name)}</p>
      <p class="summary-label">รายการ:</p>
      <ul class="summary-lines">
        ${items.map(it => `
          <li><span>${escapeHtml(it.name)} × ${it.quantity}<small>${formatPrice(it.price)} / ชิ้น</small></span>
              <strong>${formatPrice(it.price * it.quantity)}</strong></li>`).join('')}
      </ul>
      <div class="summary-total"><span>ยอดรวม:</span><strong>${formatPrice(Cart.total())}</strong></div>
      <a href="cart.html" class="btn-link">← แก้ไขตะกร้า</a>`;
    submitBtn.disabled = !storeOpen;
    submitBtn.textContent = storeOpen ? 'ยืนยันการสั่งซื้อ' : 'ร้านปิดอยู่ ยังสั่งซื้อไม่ได้';
    return true;
  }

  async function refreshCart() {
    const res = await Cart.refresh();
    storeOpen = res.storeOpen;
    showNotes(res.notes);
    renderSummary();
  }

  function showNotes(notes) {
    notesEl.innerHTML = notes.length
      ? `<div class="notice notice-warn"><ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
      : '';
  }

  function setFieldError(name, msg) {
    const field = form.elements[name];
    const holder = field.closest('.field');
    holder.classList.toggle('has-error', !!msg);
    holder.querySelector('.field-error').textContent = msg || '';
  }

  function validate() {
    const name = form.customer_name.value.trim();
    const phoneDigits = form.phone.value.replace(/[^0-9]/g, '');
    const address = form.address.value.trim();
    let ok = true;

    setFieldError('customer_name', name.length >= 2 ? '' : 'กรุณากรอกชื่อลูกค้า');
    if (name.length < 2) ok = false;

    const phoneOk = phoneDigits.length >= 9 && phoneDigits.length <= 10;
    setFieldError('phone', phoneOk ? '' : 'กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก');
    if (!phoneOk) ok = false;

    setFieldError('address', address ? '' : 'กรุณาเลือกที่อยู่ / สถานที่รับสินค้า');
    if (!address) ok = false;

    return ok;
  }

  function showOnly(view) {
    [checkoutView, payView, successView].forEach(v => { v.hidden = v !== view; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // จำออเดอร์ไว้ใน URL: รีเฟรชแล้วยังอยู่หน้าจ่ายเงินของออเดอร์เดิม (ไม่สร้างซ้ำ)
  function setPayParam(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('pay', id); else url.searchParams.delete('pay');
    history.replaceState(null, '', url);
  }

  async function fetchOrder(id) {
    const { data, error } = await sb.from('shop_orders')
      .select('id,order_number,store_id,store_name,total_amount,status,payment_status')
      .eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  /* ----- ขั้นที่ 2: หน้า QR ----- */
  async function showPay(o) {
    order = o;
    setPayParam(o.id);
    document.getElementById('payTotal').textContent = formatPrice(o.total_amount);
    document.getElementById('payStore').textContent = o.store_name;
    document.getElementById('payOrderNo').textContent = o.order_number;
    // ตะกร้ายังเป็นของออเดอร์นี้ -> ย้อนกลับได้ (ยกเลิกแล้วกลับไปแก้ไข) / ไม่ใช่ -> กลับหน้าคำสั่งซื้อของฉัน
    document.getElementById('payBackHint').hidden = !canCancelBack();
    showOnly(payView);

    const qrEl = document.getElementById('payQr');
    const accEl = document.getElementById('payAccount');
    const saveBtn = document.getElementById('saveQrBtn');
    qrEl.innerHTML = '<div class="loading">กำลังโหลด...</div>';
    const { data, error } = await sb.from('shop_settings').select('payment_qr_url,payment_account').eq('id', 1).maybeSingle();
    qrUrl = !error && data?.payment_qr_url && /^https:\/\//i.test(data.payment_qr_url) ? data.payment_qr_url : '';
    qrEl.innerHTML = qrUrl
      ? `<img src="${escapeHtml(qrUrl)}" alt="QR สำหรับโอนเงิน">`
      : '<div class="notice notice-warn">ร้านยังไม่ได้ตั้งค่า QR กรุณาติดต่อร้านทาง LINE เพื่อชำระเงิน</div>';
    saveBtn.hidden = !qrUrl;
    accEl.hidden = !data?.payment_account;
    accEl.textContent = data?.payment_account || '';
  }

  function canCancelBack() {
    const { store, items } = Cart.read();
    return !!order && items.length > 0 && store?.id === order.store_id;
  }

  async function saveQr() {
    if (!qrUrl) return;
    const name = `iF-QR-${order?.order_number || 'payment'}`;
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[blob.type] || 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast(t('บันทึก QR แล้ว'), 'success');
    } catch {
      // บางเบราว์เซอร์ (เช่นในแอป LINE) ดาวน์โหลดไม่ได้ -> เปิดรูปให้กดค้างบันทึกเอง
      window.open(qrUrl, '_blank', 'noopener');
      showToast(t('กดค้างที่รูป QR แล้วเลือกบันทึกรูปภาพ'), 'info', 5000);
    }
  }

  async function markPaid(btn) {
    if (!order) return;
    if (!confirm(t('ยืนยันว่าโอนเงิน {p} เรียบร้อยแล้ว?', { p: formatPrice(order.total_amount) }))) return;
    btn.disabled = true;
    const { error } = await sb.rpc('shop_customer_mark_paid', { p_order_id: order.id });
    btn.disabled = false;
    if (error) { showToast(translateError(error), 'error', 5000); return; }
    if (canCancelBack()) Cart.clear();
    showSuccess({ ...order, payment_status: 'waiting' });
  }

  async function goBack(btn) {
    if (!order) return;
    if (!canCancelBack()) { location.href = 'my-orders.html'; return; }
    if (!confirm(t('ยกเลิกคำสั่งซื้อ {n} แล้วกลับไปแก้ไขรายการ?', { n: order.order_number }))) return;
    btn.disabled = true;
    const { error } = await sb.rpc('shop_customer_cancel_unpaid', { p_order_id: order.id });
    btn.disabled = false;
    if (error) { showToast(translateError(error), 'error', 5000); return; }
    order = null;
    setPayParam(null);
    showOnly(checkoutView);
    try { await refreshCart(); } catch (err) { console.error(err); }
  }

  /* ----- ขั้นที่ 3: รอยืนยันออเดอร์ ----- */
  function showSuccess(o) {
    setPayParam(null);
    showOnly(successView);
    document.getElementById('successOrderNo').textContent = o.order_number;
    document.getElementById('successStore').textContent = o.store_name;
    document.getElementById('successTotal').textContent = formatPrice(o.total_amount);
    document.getElementById('successStatus').innerHTML =
      o.payment_status === 'paid' ? statusBadge(o.status) : paymentBadge(o.payment_status);

    document.getElementById('copyOrderNo').onclick = async () => {
      try {
        await navigator.clipboard.writeText(o.order_number);
        showToast('คัดลอกเลขคำสั่งซื้อแล้ว', 'success');
      } catch {
        showToast('คัดลอกไม่สำเร็จ กรุณาจดเลขคำสั่งซื้อไว้', 'warn');
      }
    };
  }

  document.getElementById('saveQrBtn').addEventListener('click', saveQr);
  document.getElementById('paidBtn').addEventListener('click', e => markPaid(e.currentTarget));
  document.getElementById('payBackBtn').addEventListener('click', e => goBack(e.currentTarget));

  /* ----- ขั้นที่ 1: สร้างคำสั่งซื้อ ----- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    errorEl.hidden = true;
    if (!validate()) return;
    if (!isConfigured()) { errorEl.hidden = false; errorEl.innerHTML = configNoticeHtml(); return; }

    const { store, items } = Cart.read();
    if (!items.length) { renderSummary(); return; }
    if (!storeOpen) return;

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งคำสั่งซื้อ...';

    try {
      const { data, error } = await sb.rpc('shop_place_order', {
        p_store_id: store.id,
        p_customer_name: form.customer_name.value.trim(),
        p_phone: form.phone.value.trim(),
        p_address: form.address.value.trim(),
        p_note: form.note.value.trim(),
        p_items: items.map(i => ({ product_id: i.id, quantity: i.quantity }))
      });
      if (error) throw error;

      // ยังไม่ล้างตะกร้า: ถ้าลูกค้ากดย้อนกลับจะได้แก้ไขต่อ (ล้างตอนกดจ่ายแล้ว)
      await showPay({ ...data, store_id: store.id });
    } catch (err) {
      console.error(err);
      const msg = translateError(err);
      errorEl.hidden = false;
      errorEl.innerHTML = `<div class="notice notice-error"><strong>${
        /สินค้าเหลือไม่เพียงพอ/.test(msg) ? 'สินค้าเหลือไม่เพียงพอ' : 'สั่งซื้อไม่สำเร็จ'
      }</strong><br>${escapeHtml(msg)}</div>`;

      // สต็อก/สถานะร้านอาจเปลี่ยน -> ดึงข้อมูลล่าสุดมาปรับตะกร้า
      try { await refreshCart(); } catch { /* ignore */ }

      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      submitting = false;
      submitBtn.disabled = !storeOpen;
      submitBtn.textContent = storeOpen ? 'ยืนยันการสั่งซื้อ' : 'ร้านปิดอยู่ ยังสั่งซื้อไม่ได้';
    }
  });

  form.querySelectorAll('input, textarea, select').forEach(el =>
    el.addEventListener('input', () => el.closest('.field')?.classList.remove('has-error')));

  // ที่อยู่ที่ผู้ดูแลระบบกำหนด (ลูกค้าเลือกได้เฉพาะรายการนี้)
  async function loadAddresses() {
    const { data, error } = await sb.from('shop_addresses').select('name').order('sort_order').order('name');
    if (error) throw error;
    form.address.innerHTML = data.length
      ? '<option value="">— เลือกที่อยู่ / สถานที่รับสินค้า —</option>' +
        data.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('')
      : '<option value="">ยังไม่มีสถานที่ให้เลือก กรุณาติดต่อทาง LINE</option>';
  }

  // เติมชื่อ/เบอร์/ที่อยู่จากคำสั่งซื้อล่าสุด หรือข้อมูลตอนสมัครสมาชิก
  async function prefill(session) {
    const meta = session.user.user_metadata || {};
    const { data } = await sb.from('shop_orders')
      .select('customer_name,phone,address')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const last = data?.[0] || {};
    const fill = (name, value) => { if (value && !form.elements[name].value) form.elements[name].value = value; };
    fill('customer_name', last.customer_name || meta.full_name);
    fill('phone', last.phone || meta.phone);
    fill('address', last.address);
  }

  // เปิดด้วย ?pay=<id> -> กลับไปขั้นตอนจ่ายเงิน/รอยืนยันของออเดอร์นั้น
  async function resumePayment(id) {
    try {
      const o = await fetchOrder(id);
      if (!o || o.status === 'cancelled') { setPayParam(null); return false; }
      if (o.payment_status === 'unpaid') await showPay(o);
      else showSuccess(o);
      return true;
    } catch (err) {
      console.error(err);
      setPayParam(null);
      return false;
    }
  }

  (async function init() {
    const payId = new URLSearchParams(location.search).get('pay');
    if (isConfigured()) {
      const session = await Auth.session();
      if (!session) { location.replace(Auth.loginUrl('checkout.html')); return; }
      // โหลดฟอร์มไว้เสมอ (กดย้อนกลับจากหน้า QR แล้วจะได้แก้ไขต่อได้)
      loadAddresses()
        .catch(err => { console.error(err); form.address.innerHTML = '<option value="">โหลดรายการที่อยู่ไม่สำเร็จ กรุณารีเฟรชหน้า</option>'; })
        .then(() => prefill(session))
        .catch(err => console.warn(err));
      if (isUuid(payId) && await resumePayment(payId)) return;
    }
    if (!renderSummary()) return;
    try {
      await refreshCart();
    } catch (err) {
      console.error(err);
    }
  })();
})();

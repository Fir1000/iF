/* =====================================================================
   app-extras.js — (หน้าของลูกค้า)
   1) ปุ่ม "ติดตั้งแอป" (PWA) — ซ่อนเองเมื่อติดตั้งแล้ว / เปิดจากแอปที่ติดตั้งแล้ว
   2) ป๊อปอัปขอความยินยอมข้อมูลส่วนบุคคล (PDPA) — ถามครั้งแรก เปลี่ยนใจได้ที่ท้ายเว็บ
   ===================================================================== */

/* ---------- เก็บค่าในเครื่อง (บางเบราว์เซอร์ปิด storage ไว้) ---------- */
const LocalPref = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } }
};

/* =====================================================================
   1) ปุ่มติดตั้งแอป
   ===================================================================== */

const INSTALLED_KEY = 'if_app_installed';

const Installer = {
  deferred: null,   // event จาก Chrome/Android สำหรับเปิดหน้าต่างติดตั้งของระบบ
  btn: null,

  isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
  isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  // เบราว์เซอร์ในแอป LINE / Facebook / Instagram ติดตั้งไม่ได้ ต้องเปิดใน Safari / Chrome ก่อน
  isInApp() { return /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent); },

  markInstalled() {
    LocalPref.set(INSTALLED_KEY, '1');
    this.render();
  },

  shouldShow() {
    if (this.isStandalone() || LocalPref.get(INSTALLED_KEY) === '1') return false;
    return !!this.deferred || this.isIOS() || this.isInApp();
  },

  render() {
    if (!this.btn) return;
    this.btn.hidden = !this.shouldShow();
    document.body.classList.toggle('has-install-btn', !this.btn.hidden);
  },

  async onClick() {
    if (this.deferred) {
      const ev = this.deferred;
      this.deferred = null;
      ev.prompt();
      const choice = await ev.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') this.markInstalled();
      else this.render();   // ยกเลิก -> Chrome จะส่ง event ใหม่มาเมื่อพร้อมให้ติดตั้งอีกครั้ง
      return;
    }
    this.showGuide();
  },

  showGuide() {
    const inApp = this.isInApp();
    const steps = inApp
      ? ['แตะปุ่ม ⋯ หรือ ⋮ มุมขวาบน', 'เลือก "เปิดในเบราว์เซอร์" (Safari / Chrome)', 'แล้วกดปุ่ม "ติดตั้งแอป" อีกครั้ง']
      : ['แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างจอ', 'เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม"', 'กด "เพิ่ม" มุมขวาบน'];
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet-dialog';
    dlg.setAttribute('aria-labelledby', 'installGuideTitle');
    dlg.innerHTML = `
      <h2 id="installGuideTitle">📲 ติดตั้งแอป iF</h2>
      <p class="muted">${inApp ? 'เบราว์เซอร์ในแอปนี้ติดตั้งไม่ได้ กรุณาเปิดในเบราว์เซอร์ก่อน' : 'ติดตั้งไว้บนหน้าจอโฮม เปิดสั่งได้เร็วเหมือนแอปทั่วไป'}</p>
      <ol class="install-steps">${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-close>เข้าใจแล้ว</button>
        ${inApp ? '' : '<button type="button" class="btn btn-ghost btn-block" data-installed>ติดตั้งแล้ว ไม่ต้องแสดงปุ่มนี้อีก</button>'}
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.querySelector('[data-installed]')?.addEventListener('click', () => { this.markInstalled(); dlg.close(); });
    dlg.showModal();
  },

  init() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'install-float';
    btn.hidden = true;
    btn.innerHTML = '<span aria-hidden="true">📲</span> <span>ติดตั้งแอป</span>';
    btn.addEventListener('click', () => this.onClick());
    document.body.appendChild(btn);
    this.btn = btn;
    this.render();
  }
};

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();               // ไม่ให้ Chrome ขึ้นแถบเอง ใช้ปุ่มของเราแทน
  Installer.deferred = e;
  Installer.render();
});
window.addEventListener('appinstalled', () => {
  Installer.deferred = null;
  Installer.markInstalled();
});
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => Installer.render());

/* =====================================================================
   2) ความยินยอมข้อมูลส่วนบุคคล (PDPA)
   ===================================================================== */

const CONSENT_KEY = 'if_consent';
const CONSENT_VERSION = 1;   // เปลี่ยนนโยบายเมื่อไร เพิ่มเลขนี้ ลูกค้าจะถูกถามใหม่

const Consent = {
  // ค่าปัจจุบัน { v, marketing: true/false, at } หรือ null = ยังไม่เคยเลือก
  get() {
    try {
      const c = JSON.parse(LocalPref.get(CONSENT_KEY));
      return c && c.v === CONSENT_VERSION ? c : null;
    } catch { return null; }
  },

  // สคริปต์วิเคราะห์ / การตลาดในอนาคต ให้เช็ก Consent.allowsMarketing() ก่อนโหลด
  allowsMarketing() { return this.get()?.marketing === true; },

  save(marketing) {
    const c = { v: CONSENT_VERSION, marketing, at: new Date().toISOString() };
    LocalPref.set(CONSENT_KEY, JSON.stringify(c));
    this.syncAccount(c);
    document.dispatchEvent(new CustomEvent('consentchange', { detail: c }));
    return c;
  },

  // ลูกค้าที่ล็อกอินอยู่: บันทึกไว้กับบัญชีด้วย (หลักฐานการให้ความยินยอม)
  async syncAccount(c = this.get()) {
    if (!c || typeof sb === 'undefined' || !isConfigured()) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const saved = session.user.user_metadata?.pdpa_consent;
      if (saved && saved.v === c.v && saved.marketing === c.marketing && saved.at === c.at) return;
      await sb.auth.updateUser({ data: { pdpa_consent: c } });
    } catch (err) {
      console.warn('บันทึกความยินยอมกับบัญชีไม่สำเร็จ', err);
    }
  },

  show({ force = false } = {}) {
    if (document.getElementById('consentDialog')) return;
    const current = this.get();
    const dlg = document.createElement('dialog');
    dlg.id = 'consentDialog';
    dlg.className = 'sheet-dialog consent-dialog';
    dlg.setAttribute('aria-labelledby', 'consentTitle');
    dlg.innerHTML = `
      <h2 id="consentTitle">🔒 ความเป็นส่วนตัวของคุณ</h2>
      <p>iF ใช้ชื่อ เบอร์โทร และที่อยู่ เพื่อรับคำสั่งซื้อ ติดต่อเรื่องการชำระเงิน และจัดส่งสินค้า</p>
      <p>หากกด "ยอมรับทั้งหมด" เราจะใช้ข้อมูลการใช้งานเว็บเพื่อวิเคราะห์ ปรับปรุงบริการ และส่งโปรโมชันที่เหมาะกับคุณ</p>
      <p class="muted small">ไม่ยอมรับส่วนนี้ก็ยังสั่งซื้อได้ตามปกติ และเปลี่ยนใจได้ทุกเมื่อที่ท้ายหน้าเว็บ</p>
      ${current ? `<p class="consent-current">${current.marketing ? 'ตอนนี้: ยอมรับทั้งหมด' : 'ตอนนี้: เฉพาะที่จำเป็น'}</p>` : ''}
      <a href="privacy.html" class="btn-link">อ่านนโยบายความเป็นส่วนตัว</a>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-lg btn-block" data-consent="all" autofocus>ยอมรับทั้งหมด</button>
        <button type="button" class="btn btn-ghost btn-block" data-consent="necessary">เฉพาะที่จำเป็น</button>
      </div>`;
    document.body.appendChild(dlg);
    // ครั้งแรกต้องเลือกก่อน (ปิดด้วย Esc ไม่ได้) / เปิดจากท้ายเว็บ ปิดได้ตามปกติ
    if (!force) dlg.addEventListener('cancel', e => e.preventDefault());
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelectorAll('[data-consent]').forEach(b => b.addEventListener('click', () => {
      const c = this.save(b.dataset.consent === 'all');
      dlg.close();
      if (force) showToast(c.marketing ? 'บันทึกแล้ว: ยอมรับทั้งหมด' : 'บันทึกแล้ว: เฉพาะที่จำเป็น', 'success');
    }));
    dlg.showModal();
  },

  init() {
    document.querySelectorAll('[data-consent-open]').forEach(el =>
      el.addEventListener('click', e => { e.preventDefault(); this.show({ force: true }); }));
    // หน้านโยบายเอง ไม่บังหน้าจอ ให้อ่านก่อนตัดสินใจได้
    const onPolicyPage = /privacy\.html$/.test(location.pathname);
    if (!this.get() && !onPolicyPage) this.show();
    else this.syncAccount();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('admin')) return;
  Installer.init();
  Consent.init();
});

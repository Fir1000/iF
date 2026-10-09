/* =====================================================================
   sw.js — Service Worker ให้ติดตั้งเว็บเป็นแอปบนมือถือได้ (PWA)
   ไฟล์ของเว็บ: โหลดจากเน็ตก่อนเสมอ (ได้เวอร์ชันล่าสุด) ถ้าออฟไลน์ค่อยใช้ที่เก็บไว้
   ข้อมูลร้าน/สินค้า/ออเดอร์ (Supabase) ไม่ผ่านแคชนี้
   ===================================================================== */

const CACHE = 'if-shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      throw err;
    }
  })());
});

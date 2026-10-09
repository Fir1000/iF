/* =====================================================================
   i18n.js — ปุ่มสลับภาษา ไทย / English (หน้าของลูกค้า)
   หน้าเว็บเขียนเป็นภาษาไทย ถ้าเลือก EN จะแปลข้อความบนหน้าด้วยพจนานุกรมด้านล่าง
   รวมถึงข้อความที่เกิดทีหลัง (การ์ด, ป้ายแจ้งเตือน, ข้อผิดพลาด) ผ่าน MutationObserver
   ชื่อร้าน/สินค้าที่ผู้ดูแลพิมพ์เองจะคงภาษาเดิม
   ===================================================================== */

const LANG_KEY = 'if_lang';

const I18N = {
  // ?lang=en หรือ ?lang=th ในลิงก์ เลือกภาษาให้ได้เลย (แชร์ลิงก์ภาษาอังกฤษได้)
  lang: (() => {
    const q = new URLSearchParams(location.search).get('lang');
    try {
      if (q === 'en' || q === 'th') localStorage.setItem(LANG_KEY, q);
      return (q || localStorage.getItem(LANG_KEY)) === 'en' ? 'en' : 'th';
    } catch { return q === 'en' ? 'en' : 'th'; }
  })(),

  // ข้อความไทย -> อังกฤษ ({x} = ค่าที่เปลี่ยนไปตามข้อมูล)
  dict: {
    /* ----- เมนู / ส่วนหัว / ท้ายเว็บ ----- */
    'เมนูหลัก': 'Main menu',
    'หน้าแรก': 'Home',
    'ร้านค้า': 'Stores',
    'เกี่ยวกับเรา': 'About',
    'ติดต่อ': 'Contact',
    'เข้าสู่ระบบ': 'Log in',
    'ตะกร้าสินค้า': 'Cart',
    'ตะกร้า': 'Cart',
    'เปิดเมนู': 'Open menu',
    'โลโก้ iF': 'iF logo',
    'คำสั่งซื้อของฉัน': 'My orders',
    'หลังร้าน': 'Admin',
    'เมนู': 'Menu',
    'ไรเดอร์ส่งของกิน': 'Food delivery rider',
    'iF ไรเดอร์ส่งของกิน': 'iF Food Delivery',
    'เพจ iF': 'iF page',
    'ดูตะกร้า →': 'View cart →',
    'สั่งทาง LINE': 'Order via LINE',
    'สั่งอาหารทาง LINE': 'Order via LINE',
    '{n} ชิ้น': '{n} items',

    /* ----- ชื่อแท็บ ----- */
    'iF | ไรเดอร์ส่งของกิน': 'iF | Food Delivery',
    'ร้านค้า | iF': 'Store | iF',
    'ตะกร้าสินค้า | iF': 'Cart | iF',
    'สั่งซื้อสินค้า | iF': 'Checkout | iF',
    'คำสั่งซื้อของฉัน | iF': 'My orders | iF',
    'เข้าสู่ระบบ | iF': 'Log in | iF',

    /* ----- หน้าแรก ----- */
    'หิวเมื่อไหร่ iF ไปส่งถึงที่': 'Hungry? iF delivers to you',
    'รวมร้านอร่อยไว้ในที่เดียว เลือกร้าน เลือกเมนู แล้วไรเดอร์ iF รับไปส่งถึงหน้าบ้าน ร้อน ๆ':
      'Great local stores in one place. Pick a store, pick your items, and an iF rider brings them to your door — still hot.',
    'เลือกร้านค้า': 'Choose a store',
    'เลือกร้านที่ชอบ': 'Pick your favorite',
    'ร้านค้าทั้งหมด': 'All stores',
    'กำลังโหลดร้านค้า...': 'Loading stores...',
    'ไรเดอร์ท้องถิ่น ส่งของกินด้วยใจ': 'Local riders who deliver with care',
    'iF คือบริการไรเดอร์ส่งของกิน รับอาหารจากร้านอร่อยใกล้บ้าน แล้วส่งตรงถึงหน้าประตูคุณ ไม่ต้องออกไปต่อคิวเอง':
      'iF is a local food delivery service. We pick up from great stores nearby and bring your order straight to your door — no queuing.',
    'เราตั้งใจให้ทุกคนได้กินของอร่อยแบบสะดวก และช่วยให้ร้านอาหารเล็ก ๆ ในพื้นที่ขายได้มากขึ้น':
      'We want everyone to enjoy good food with ease, and to help small local stores sell more.',
    'ดูร้านค้าทั้งหมด': 'See all stores',
    'สั่ง · รับ · ส่งถึงมือ': 'Order · Pick up · Deliver',
    'ติดต่อเรา': 'Contact us',
    'สั่งหรือสอบถามได้ทุกช่องทาง': 'Order or ask us any way you like',
    'เข้าร้านค้า': 'Enter store',
    'เข้าร้านค้า (ปิดอยู่)': 'Enter store (closed)',
    'เพิ่มร้านค้า': 'Add store',
    'ผู้ดูแลระบบ': 'Admin',
    'ยังไม่มีร้านค้า': 'No stores yet',
    'กรุณากลับมาใหม่เร็ว ๆ นี้': 'Please check back soon',
    'โหลดร้านค้าไม่สำเร็จ: {e}': 'Could not load stores: {e}',
    'ลองใหม่': 'Try again',
    '● เปิดอยู่': '● Open',
    '● ปิดอยู่': '● Closed',

    /* ----- หน้าร้าน ----- */
    'ค้นหาสินค้าในร้านนี้...': 'Search this store...',
    'ค้นหาสินค้า': 'Search products',
    'ไม่พบร้านค้านี้': 'Store not found',
    'ไม่พบร้านค้า': 'Store not found',
    'ร้านนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง': 'This store may have been removed, or the link is wrong.',
    'รูปร้าน {a}': '{a} photo',
    'ร้านนี้ปิดอยู่ตอนนี้ ดูสินค้าได้ แต่ยังสั่งซื้อไม่ได้': 'This store is closed right now. You can browse, but ordering is unavailable.',
    'สินค้าหมด': 'Sold out',
    'คงเหลือ {n} ชิ้น': '{n} left',
    '✓ อยู่ในตะกร้า {n} ชิ้น': '✓ {n} in cart',
    'เลือกจำนวน': 'Choose quantity',
    'จำนวน': 'Quantity',
    'ลดจำนวน': 'Decrease',
    'เพิ่มจำนวน': 'Increase',
    'ร้านปิดอยู่': 'Store closed',
    'ครบจำนวนแล้ว': 'Max in cart',
    '🛒 เพิ่มลงตะกร้า': '🛒 Add to cart',
    'พบสินค้า {n} รายการ': '{n} products',
    'ไม่พบสินค้าที่ค้นหา': 'No matching products',
    'ร้านนี้ยังไม่มีสินค้า': 'No products yet',
    'ลองเปลี่ยนคำค้นหาหรือหมวดหมู่': 'Try a different search',
    'เพิ่ม "{a}" {n} ชิ้นลงตะกร้าแล้ว': 'Added {n} × "{a}" to cart',
    'เลือกได้สูงสุด {n} ชิ้น': 'Maximum {n}',
    'โหลดร้านค้าไม่สำเร็จ:': 'Could not load the store:',

    /* ----- ตะกร้า ----- */
    '/ ตะกร้าสินค้า': '/ Cart',
    '🛒 ตะกร้าสินค้า': '🛒 Cart',
    'กำลังโหลดตะกร้า...': 'Loading cart...',
    'ตะกร้าของคุณยังว่าง': 'Your cart is empty',
    'เลือกร้านที่ชอบ แล้วเลือกสินค้าได้เลย': 'Pick a store and start adding items',
    '🏪 สั่งจากร้าน': '🏪 Ordering from',
    'เลือกสินค้าเพิ่ม': 'Add more items',
    'ลบ': 'Remove',
    'สรุปคำสั่งซื้อ': 'Order summary',
    'ร้านค้า:': 'Store:',
    'ยอดรวมทั้งหมด': 'Total',
    'สั่งซื้อ': 'Checkout',
    'เลือกสินค้าต่อ': 'Continue shopping',
    'ลบสินค้าออกจากตะกร้าแล้ว': 'Removed from cart',
    'สินค้าเหลือ {n} ชิ้น': 'Only {n} left',
    'เพิ่มได้อีกไม่เกิน {n} ชิ้น': 'You can add up to {n} more',
    'มีในตะกร้าครบจำนวนคงเหลือแล้ว ({n} ชิ้น)': 'Your cart already has all remaining stock ({n})',
    'ร้านค้านี้ถูกลบออกจากระบบแล้ว จึงล้างตะกร้าให้': 'This store was removed, so your cart was cleared',
    '"{a}" ปิดการขายแล้ว จึงถูกนำออกจากตะกร้า': '"{a}" is no longer available and was removed from your cart',
    '"{a}" สินค้าหมด จึงถูกนำออกจากตะกร้า': '"{a}" is sold out and was removed from your cart',
    '"{a}" เหลือ {n} ชิ้น ปรับจำนวนในตะกร้าให้แล้ว': 'Only {n} of "{a}" left — quantity adjusted',
    'ราคา "{a}" เปลี่ยนเป็น {p}': 'Price of "{a}" changed to {p}',
    'ร้าน "{a}" ปิดอยู่ตอนนี้ ยังสั่งซื้อไม่ได้': '"{a}" is closed right now — ordering is unavailable',
    'ตะกร้ามีสินค้าจากร้าน "{a}" อยู่\n\nสั่งได้ครั้งละ 1 ร้าน — ล้างตะกร้าเดิมแล้วเริ่มสั่งจากร้าน "{b}" ?':
      'Your cart has items from "{a}".\n\nYou can order from one store at a time — clear your cart and start ordering from "{b}"?',

    /* ----- สั่งซื้อ ----- */
    '/ สั่งซื้อ': '/ Checkout',
    'ข้อมูลการสั่งซื้อ': 'Checkout',
    'กรอกข้อมูลลูกค้า ตรวจสอบรายการ แล้วกดยืนยัน ติดตามสถานะได้ที่หน้า "คำสั่งซื้อของฉัน"':
      'Fill in your details, check your order and confirm. Track it on the "My orders" page.',
    'ข้อมูลลูกค้า': 'Your details',
    'ชื่อลูกค้า': 'Name',
    'เบอร์โทรศัพท์': 'Phone number',
    'ที่อยู่ / สถานที่รับสินค้า': 'Delivery address / pickup point',
    'กำลังโหลดรายการที่อยู่...': 'Loading addresses...',
    'เลือกได้เฉพาะสถานที่ที่ให้บริการ — เลขห้องหรือจุดสังเกตใส่ในช่องหมายเหตุ':
      'Only our service locations can be chosen — add your room number or a landmark in the note.',
    'หมายเหตุเพิ่มเติม': 'Note',
    'เช่น ห้อง 305 ชั้น 3, ไม่ใส่ผัก, เวลาที่สะดวกรับของ': 'e.g. Room 305, 3rd floor, no vegetables, best time to receive',
    'ไม่บังคับ': 'Optional',
    'ยืนยันการสั่งซื้อ': 'Confirm order',
    'หลังสั่งซื้อ ร้านจะรับออเดอร์และติดต่อกลับเพื่อยืนยันการชำระเงิน': 'After you order, the store will accept it and contact you to confirm payment.',
    'กำลังโหลด...': 'Loading...',
    'สรุปรายการก่อนยืนยัน': 'Review your order',
    'รายการ:': 'Items:',
    '{p} / ชิ้น': '{p} each',
    'ยอดรวม:': 'Total:',
    'ยอดรวม': 'Total',
    '← แก้ไขตะกร้า': '← Edit cart',
    'ร้านปิดอยู่ ยังสั่งซื้อไม่ได้': 'Store closed — cannot order',
    'ยังไม่มีสินค้าในตะกร้า': 'Your cart is empty',
    'กรุณาเลือกสินค้าก่อนดำเนินการสั่งซื้อ': 'Please add items before checking out',
    'กรุณากรอกชื่อลูกค้า': 'Please enter your name',
    'กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก': 'Please enter a 9–10 digit phone number',
    'กรุณาเลือกที่อยู่ / สถานที่รับสินค้า': 'Please choose a delivery address / pickup point',
    '— เลือกที่อยู่ / สถานที่รับสินค้า —': '— Choose address / pickup point —',
    'ยังไม่มีสถานที่ให้เลือก กรุณาติดต่อทาง LINE': 'No locations available — please contact us on LINE',
    'โหลดรายการที่อยู่ไม่สำเร็จ กรุณารีเฟรชหน้า': 'Could not load addresses — please refresh',
    'หอ {n}': 'Dorm {n}',
    'กำลังส่งคำสั่งซื้อ...': 'Placing order...',
    'สินค้าเหลือไม่เพียงพอ': 'Not enough stock',
    'สั่งซื้อไม่สำเร็จ': 'Order failed',
    'สั่งซื้อสำเร็จ': 'Order placed',
    'ขอบคุณที่สั่งกับ iF ร้านจะรับออเดอร์และติดต่อกลับโดยเร็ว': 'Thank you for ordering with iF. The store will accept your order and contact you soon.',
    'เลขคำสั่งซื้อ': 'Order number',
    'คัดลอก': 'Copy',
    'สถานะ': 'Status',
    'คัดลอกเลขคำสั่งซื้อแล้ว': 'Order number copied',
    'คัดลอกไม่สำเร็จ กรุณาจดเลขคำสั่งซื้อไว้': 'Copy failed — please note your order number',
    'กรุณาแจ้งเลขคำสั่งซื้อเมื่อติดต่อร้านทาง LINE': 'Please give your order number when contacting us on LINE',
    '📦 ติดตามสถานะคำสั่งซื้อ': '📦 Track order',
    '💬 ติดต่อร้านผ่าน LINE': '💬 Contact us on LINE',
    'เลือกร้านค้าอื่นต่อ': 'Browse other stores',

    /* ----- สถานะคำสั่งซื้อ ----- */
    'รอรับออเดอร์': 'Waiting for store',
    'รับออเดอร์แล้ว': 'Accepted',
    'กำลังเตรียมสินค้า': 'Preparing',
    'พร้อมรับสินค้า': 'Ready',
    'เสร็จสิ้น': 'Completed',
    'ยกเลิก': 'Cancelled',

    /* ----- คำสั่งซื้อของฉัน ----- */
    '/ คำสั่งซื้อของฉัน': '/ My orders',
    '📦 คำสั่งซื้อของฉัน': '📦 My orders',
    'ติดตามสถานะคำสั่งซื้อ หน้านี้อัปเดตเองเมื่อร้านเปลี่ยนสถานะ': 'Track your orders. This page updates automatically when the store changes the status.',
    'เข้าสู่ระบบด้วย': 'Logged in as',
    'ออกจากระบบ': 'Log out',
    'กำลังโหลดคำสั่งซื้อ...': 'Loading orders...',
    'สั่งเมื่อ {d}': 'Ordered {d}',
    'ยังไม่มีคำสั่งซื้อ': 'No orders yet',
    'เลือกร้านที่ชอบแล้วสั่งได้เลย': 'Pick a store and place your first order',
    'คำสั่งซื้อนี้ถูกยกเลิก หากมีข้อสงสัยกรุณาติดต่อทาง LINE': 'This order was cancelled. If you have questions, please contact us on LINE.',
    'คำสั่งซื้อ {a} อัปเดตสถานะเป็น "{b}"': 'Order {a} is now "{b}"',

    /* ----- เข้าสู่ระบบ / สมัครสมาชิก ----- */
    'ลูกค้าและผู้ดูแลร้านเข้าสู่ระบบได้ที่นี่': 'Customers and store admins log in here',
    'สมัครสมาชิก': 'Sign up',
    'อีเมล': 'Email',
    'รหัสผ่าน': 'Password',
    'ชื่อ-นามสกุล': 'Full name',
    'อย่างน้อย 6 ตัวอักษร': 'At least 6 characters',
    '← กลับหน้าร้าน': '← Back to shop',
    'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ': 'This account is not an admin',
    'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนสั่งซื้อสินค้า': 'Please log in or sign up before ordering',
    'กรุณากรอกอีเมลและรหัสผ่าน': 'Please enter your email and password',
    'กำลังเข้าสู่ระบบ...': 'Logging in...',
    'กรุณากรอกชื่อ-นามสกุล': 'Please enter your full name',
    'กำลังสมัครสมาชิก...': 'Signing up...',
    'สมัครสมาชิกสำเร็จ กรุณากดลิงก์ยืนยันในอีเมลของคุณ แล้วกลับมาเข้าสู่ระบบ': 'Signed up! Please click the confirmation link in your email, then come back and log in.',

    /* ----- ข้อผิดพลาด ----- */
    'เกิดข้อผิดพลาด': 'Something went wrong',
    'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่': 'Cannot reach the server. Check your internet and try again.',
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง': 'Incorrect email or password',
    'อีเมลนี้สมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ': 'This email is already registered. Please log in.',
    'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร': 'Password must be at least 6 characters',
    'ระบบยังไม่เปิดให้สมัครสมาชิก กรุณาติดต่อร้าน': 'Sign-ups are not open yet. Please contact us.',
    'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่': 'Too many attempts. Please wait a moment and try again.',
    'รูปแบบอีเมลไม่ถูกต้อง': 'Invalid email address',
    'บัญชีนี้ยังไม่ได้ยืนยันอีเมล': 'This account has not confirmed its email yet',
    'ไม่มีสิทธิ์ดำเนินการนี้': 'You do not have permission to do this',
    'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่': 'Session expired. Please log in again.',
    'ข้อมูลไม่ถูกต้อง': 'Invalid data',
    'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ': 'Please log in before ordering',
    'ร้าน "{a}" ปิดอยู่ ยังไม่รับคำสั่งซื้อ': '"{a}" is closed and not taking orders',
    'กรุณากรอกชื่อลูกค้าให้ถูกต้อง': 'Please enter a valid name',
    'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง': 'Please enter a valid phone number',
    'กรุณาเลือกที่อยู่ / สถานที่รับสินค้าจากรายการที่กำหนด': 'Please choose an address / pickup point from the list',
    'ตะกร้าสินค้าว่าง': 'Your cart is empty',
    'จำนวนรายการสินค้ามากเกินไป': 'Too many items',
    'มีการสั่งซื้อถี่เกินไป กรุณารอสักครู่': 'Ordering too often. Please wait a moment.',
    'จำนวนสินค้าไม่ถูกต้อง': 'Invalid quantity',
    'มีสินค้าบางรายการปิดการขายแล้ว กรุณาตรวจสอบตะกร้าอีกครั้ง': 'Some items are no longer available. Please check your cart.',
    'สินค้าเหลือไม่เพียงพอ: {a} (เหลือ {n} ชิ้น)': 'Not enough stock: {a} ({n} left)'
  },

  exact: null,
  patterns: null,

  build() {
    this.exact = new Map();
    this.patterns = [];
    for (const [th, en] of Object.entries(this.dict)) {
      if (!th.includes('{')) { this.exact.set(norm(th), en); continue; }
      const names = [];
      const re = th.split(/(\{\w+\})/).map(part => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) { names.push(m[1]); return '([\\s\\S]+?)'; }
        return norm(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      this.patterns.push({ re: new RegExp('^' + re + '$'), names, en, size: th.replace(/\{\w+\}/g, '').length });
    }
    // แบบที่เจาะจงกว่า (ตัวอักษรคงที่ยาวกว่า) ลองก่อน เช่น "คงเหลือ {n} ชิ้น" ก่อน "{n} ชิ้น"
    this.patterns.sort((a, b) => b.size - a.size);
  },

  // แปลข้อความไทยทั้งก้อน (คืนค่าเดิมถ้าไม่รู้จัก)
  translate(text) {
    const key = norm(text);
    if (this.exact.has(key)) return this.exact.get(key);
    for (const p of this.patterns) {
      const m = p.re.exec(key);
      if (!m) continue;
      let out = p.en;
      p.names.forEach((name, i) => {
        const val = m[i + 1];
        out = out.split('{' + name + '}').join(this.exact.get(norm(val)) ?? val);
      });
      return out;
    }
    return text;
  }
};

const TH_RE = /[฀-๿]/;
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

// ใช้ใน JS กับข้อความที่ไม่ได้อยู่บนหน้าเว็บ เช่น confirm()
function t(template, params = {}) {
  let out = template;
  if (I18N.lang === 'en') {
    if (!I18N.exact) I18N.build();
    out = I18N.dict[template] ?? template;
  }
  for (const [k, v] of Object.entries(params)) out = out.split('{' + k + '}').join(v);
  return out;
}

/* ---------- แปลข้อความบนหน้าเว็บ ---------- */

const I18N_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

function i18nTextNode(node) {
  const text = node.data;
  if (!TH_RE.test(text)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest('script, style, [data-no-i18n]')) return;
  const out = I18N.translate(text);
  if (out !== text) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    node.data = lead + out + tail;
  }
}

function i18nElement(el) {
  if (el.closest('[data-no-i18n]')) return;
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute(a);
    if (v && TH_RE.test(v)) {
      const out = I18N.translate(v);
      if (out !== v) el.setAttribute(a, out);
    }
  }
}

function i18nTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { i18nTextNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  i18nElement(root);
  root.querySelectorAll('*').forEach(i18nElement);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) i18nTextNode(n);
}

/* ---------- ปุ่ม TH | EN ---------- */

function initLangSwitch() {
  const nav = document.querySelector('.navbar');
  if (!nav || nav.querySelector('.lang-switch')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lang-switch';
  btn.setAttribute('data-no-i18n', '');
  btn.setAttribute('aria-label', I18N.lang === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English');
  btn.innerHTML = `<span class="${I18N.lang === 'th' ? 'on' : ''}">TH</span><span class="${I18N.lang === 'en' ? 'on' : ''}">EN</span>`;
  btn.addEventListener('click', () => {
    try { localStorage.setItem(LANG_KEY, I18N.lang === 'en' ? 'th' : 'en'); } catch { /* ignore */ }
    location.reload();
  });
  nav.insertBefore(btn, nav.querySelector('.account-link') || nav.querySelector('.cart-link'));
}

document.addEventListener('DOMContentLoaded', initLangSwitch);

if (I18N.lang === 'en') {
  I18N.build();
  document.documentElement.lang = 'en';
  // แปลทุกอย่างที่ถูกเพิ่มเข้าหน้าเว็บ ตั้งแต่ตอนโหลดจนถึงข้อความที่ JS สร้างทีหลัง
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') i18nTextNode(r.target);
      else if (r.type === 'attributes') i18nElement(r.target);
      else r.addedNodes.forEach(i18nTree);
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: I18N_ATTRS
  });
  document.addEventListener('DOMContentLoaded', () => i18nTree(document.documentElement));
}

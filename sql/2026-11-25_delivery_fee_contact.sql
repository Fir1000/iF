-- =====================================================================
-- 1) ค่าส่ง + ส่งฟรีเมื่อยอดถึงขั้นต่ำ (ตั้งค่าในหลังร้าน > ⚙️ ตั้งค่า)
-- 2) ช่องทางติดต่อลูกค้า (Facebook / LINE ID) บังคับกรอกตอนสั่งซื้อ
-- รันใน Supabase > SQL Editor ได้หลายครั้ง (idempotent)
-- =====================================================================

alter table public.shop_settings
  add column if not exists delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  add column if not exists free_delivery_min numeric(10,2) not null default 79 check (free_delivery_min >= 0);

alter table public.shop_orders
  add column if not exists delivery_fee numeric(10,2) not null default 0,
  add column if not exists contact text;

-- total_amount = ค่าสินค้า + ค่าส่ง (ยอดที่ลูกค้าต้องโอน)
drop function if exists public.shop_place_order(uuid, text, text, text, text, jsonb);

create or replace function public.shop_place_order(p_store_id uuid, p_customer_name text, p_phone text, p_address text,
                                                   p_note text, p_items jsonb, p_contact text default null)
returns json
language plpgsql security definer set search_path = public
as $function$
declare
  v_uid     uuid := auth.uid();
  v_email   text := coalesce(auth.jwt() ->> 'email', '');
  v_name    text := trim(coalesce(p_customer_name, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_address text := trim(coalesce(p_address, ''));
  v_note    text := left(trim(coalesce(p_note, '')), 1000);
  v_contact text := trim(coalesce(p_contact, ''));
  v_today   date := (now() at time zone 'Asia/Bangkok')::date;
  v_store   public.shop_stores%rowtype;
  v_seq     integer;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_fee     numeric(10,2) := 0;
  v_set     public.shop_settings%rowtype;
  v_item    record;
  v_product public.shop_products%rowtype;
  v_recent  integer;
begin
  if v_uid is null then
    raise exception 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ' using errcode = '42501';
  end if;

  select * into v_store from public.shop_stores where id = p_store_id;
  if not found then raise exception 'ไม่พบร้านค้านี้'; end if;
  if v_store.status <> 'open' then
    raise exception 'ร้าน "%" ปิดอยู่ ยังไม่รับคำสั่งซื้อ', v_store.name;
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 150 then raise exception 'กรุณากรอกชื่อลูกค้าให้ถูกต้อง'; end if;
  if char_length(v_phone) < 9 or char_length(v_phone) > 15 then raise exception 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง'; end if;
  if char_length(v_contact) < 2 or char_length(v_contact) > 150 then
    raise exception 'กรุณากรอกช่องทางติดต่อ Facebook หรือ LINE ID';
  end if;
  if not exists (select 1 from public.shop_addresses where name = v_address) then
    raise exception 'กรุณาเลือกที่อยู่ / สถานที่รับสินค้าจากรายการที่กำหนด';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ตะกร้าสินค้าว่าง'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'จำนวนรายการสินค้ามากเกินไป'; end if;

  -- กันสแปม: บัญชีหรือเบอร์เดียวกันสั่งเกิน 5 ครั้งใน 10 นาที
  select count(*) into v_recent from public.shop_orders
   where (user_id = v_uid or phone = v_phone) and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then raise exception 'มีการสั่งซื้อถี่เกินไป กรุณารอสักครู่'; end if;

  insert into public.shop_order_counters as c (order_date, last_number) values (v_today, 1)
  on conflict (order_date) do update set last_number = c.last_number + 1
  returning last_number into v_seq;
  v_order_number := 'IF-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into public.shop_orders (order_number, store_id, store_name, user_id, customer_email,
                                  customer_name, phone, contact, address, note, total_amount, status, payment_status)
  values (v_order_number, v_store.id, v_store.name, v_uid, v_email,
          v_name, v_phone, v_contact, v_address, v_note, 0, 'pending', 'unpaid')
  returning id into v_order_id;

  -- รวมสินค้าที่ซ้ำ และล็อกตามลำดับ id (กัน deadlock)
  for v_item in
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 or v_item.quantity > 1000 then raise exception 'จำนวนสินค้าไม่ถูกต้อง'; end if;
    select * into v_product from public.shop_products where id = v_item.product_id for update;
    if not found or v_product.status <> 'active' or v_product.store_id <> v_store.id then
      raise exception 'มีสินค้าบางรายการปิดการขายแล้ว กรุณาตรวจสอบตะกร้าอีกครั้ง';
    end if;
    if v_product.stock < v_item.quantity then
      raise exception 'สินค้าเหลือไม่เพียงพอ: % (เหลือ % ชิ้น)', v_product.name, v_product.stock;
    end if;
    update public.shop_products set stock = stock - v_item.quantity where id = v_product.id;
    insert into public.shop_order_items (order_id, product_id, product_name, quantity, price, subtotal)
    values (v_order_id, v_product.id, v_product.name, v_item.quantity, v_product.price, v_product.price * v_item.quantity);
    v_subtotal := v_subtotal + v_product.price * v_item.quantity;
  end loop;

  -- ค่าส่ง: ยอดสินค้าถึงขั้นต่ำ = ส่งฟรี
  select * into v_set from public.shop_settings where id = 1;
  if found and v_set.delivery_fee > 0 and v_subtotal < v_set.free_delivery_min then
    v_fee := v_set.delivery_fee;
  end if;

  update public.shop_orders set total_amount = v_subtotal + v_fee, delivery_fee = v_fee where id = v_order_id;

  return json_build_object('id', v_order_id, 'order_number', v_order_number, 'store_name', v_store.name,
                           'total_amount', v_subtotal + v_fee, 'delivery_fee', v_fee,
                           'status', 'pending', 'payment_status', 'unpaid', 'created_at', now());
end;
$function$;

revoke all on function public.shop_place_order(uuid, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.shop_place_order(uuid, text, text, text, text, jsonb, text) to authenticated;

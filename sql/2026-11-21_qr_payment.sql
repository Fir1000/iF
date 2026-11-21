-- =====================================================================
-- ระบบชำระเงินด้วย QR (บังคับจ่ายก่อน แล้ว Admin ยืนยันออเดอร์)
-- รันครั้งเดียวใน Supabase Dashboard > SQL Editor
-- =====================================================================

-- ตั้งค่าการชำระเงิน (มีแถวเดียว id = 1)
create table if not exists public.shop_settings (
  id smallint primary key default 1 check (id = 1),
  payment_qr_url text,
  payment_account text,
  updated_at timestamptz not null default now()
);
insert into public.shop_settings (id) values (1) on conflict do nothing;
alter table public.shop_settings enable row level security;
drop policy if exists shop_settings_select on public.shop_settings;
create policy shop_settings_select on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists shop_settings_update on public.shop_settings;
create policy shop_settings_update on public.shop_settings for update to authenticated
  using ((select public.shop_is_admin())) with check ((select public.shop_is_admin()));

-- สถานะการชำระเงิน: unpaid = ยังไม่จ่าย, waiting = ลูกค้าแจ้งจ่ายแล้ว รอตรวจ, paid = Admin ยืนยันแล้ว
-- ออเดอร์เก่าก่อนมีระบบนี้ = null
alter table public.shop_orders
  add column if not exists payment_status text check (payment_status in ('unpaid', 'waiting', 'paid')),
  add column if not exists paid_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz;
alter table public.shop_orders alter column payment_status set default 'unpaid';

-- place_order: เหมือนเดิม + คืน id และ payment_status
create or replace function public.shop_place_order(p_store_id uuid, p_customer_name text, p_phone text, p_address text, p_note text, p_items jsonb)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_email   text := coalesce(auth.jwt() ->> 'email', '');
  v_name    text := trim(coalesce(p_customer_name, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_address text := trim(coalesce(p_address, ''));
  v_note    text := left(trim(coalesce(p_note, '')), 1000);
  v_today   date := (now() at time zone 'Asia/Bangkok')::date;
  v_store   public.shop_stores%rowtype;
  v_seq     integer;
  v_order_id uuid;
  v_order_number text;
  v_total   numeric(12,2) := 0;
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
                                  customer_name, phone, address, note, total_amount, status, payment_status)
  values (v_order_number, v_store.id, v_store.name, v_uid, v_email,
          v_name, v_phone, v_address, v_note, 0, 'pending', 'unpaid')
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
    v_total := v_total + v_product.price * v_item.quantity;
  end loop;

  update public.shop_orders set total_amount = v_total where id = v_order_id;

  return json_build_object('id', v_order_id, 'order_number', v_order_number, 'store_name', v_store.name,
                           'total_amount', v_total, 'status', 'pending', 'payment_status', 'unpaid', 'created_at', now());
end;
$function$;

-- ลูกค้ากด "จ่ายแล้วเรียบร้อย" -> รอ Admin ตรวจ
create or replace function public.shop_customer_mark_paid(p_order_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_order public.shop_orders%rowtype;
begin
  select * into v_order from public.shop_orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'ไม่พบคำสั่งซื้อ'; end if;
  if v_order.status = 'cancelled' then raise exception 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว'; end if;
  if v_order.payment_status = 'unpaid' then
    update public.shop_orders set payment_status = 'waiting', paid_at = now() where id = p_order_id;
  end if;
end;
$$;

-- ลูกค้ากด "ย้อนกลับ" ก่อนจ่าย: ลบออเดอร์ที่ยังไม่จ่าย และคืนสต็อก
create or replace function public.shop_customer_cancel_unpaid(p_order_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_order public.shop_orders%rowtype; v_item record;
begin
  select * into v_order from public.shop_orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then return; end if;
  if v_order.payment_status is distinct from 'unpaid' or v_order.status <> 'pending' then
    raise exception 'คำสั่งซื้อนี้แจ้งชำระเงินแล้ว ยกเลิกเองไม่ได้ กรุณาติดต่อร้าน';
  end if;
  for v_item in
    select product_id, sum(quantity)::integer qty from public.shop_order_items
     where order_id = p_order_id and product_id is not null group by product_id order by product_id
  loop
    update public.shop_products set stock = stock + v_item.qty where id = v_item.product_id;
  end loop;
  delete from public.shop_orders where id = p_order_id;
end;
$$;

-- Admin ตรวจยอดโอนแล้วกด "ยืนยันออเดอร์" -> ชำระแล้ว + รับออเดอร์แล้ว
create or replace function public.shop_admin_confirm_payment(p_order_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_order public.shop_orders%rowtype;
begin
  if not public.shop_is_admin() then raise exception 'ไม่มีสิทธิ์ดำเนินการ' using errcode = '42501'; end if;
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then raise exception 'ไม่พบคำสั่งซื้อ'; end if;
  if v_order.status = 'cancelled' then raise exception 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว'; end if;
  update public.shop_orders
     set payment_status = 'paid', payment_confirmed_at = now(),
         status = case when status = 'pending' then 'accepted' else status end
   where id = p_order_id;
end;
$$;

revoke all on function public.shop_customer_mark_paid(uuid), public.shop_customer_cancel_unpaid(uuid), public.shop_admin_confirm_payment(uuid) from public, anon;
grant execute on function public.shop_customer_mark_paid(uuid), public.shop_customer_cancel_unpaid(uuid), public.shop_admin_confirm_payment(uuid) to authenticated;

-- =====================================================================
-- หน้า "ตั้งค่า" หลังร้าน: ช่องทางติดต่อ ที่ตั้ง ข้อความหน้าร้าน และรายชื่อ Admin
-- รันใน Supabase > SQL Editor ได้หลายครั้ง (idempotent)
-- =====================================================================

alter table public.shop_settings
  add column if not exists line_id text,
  add column if not exists facebook_url text,
  add column if not exists messenger_url text,
  add column if not exists location_text text,
  add column if not exists map_url text,
  add column if not exists site_content jsonb not null default '{}'::jsonb;

-- ค่าเริ่มต้นเท่ากับที่ใช้อยู่ตอนนี้
update public.shop_settings
   set line_id = coalesce(line_id, '141414dw'),
       facebook_url = coalesce(facebook_url, 'https://www.facebook.com/share/19Va1WBDbJ/')
 where id = 1;

-- ---------- รายชื่อ Admin (อ่านอีเมลจาก auth.users ได้เฉพาะ Admin) ----------

create or replace function public.shop_admin_list()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.shop_is_admin() then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  return query
    select a.user_id, u.email::text, a.created_at
      from public.shop_admins a
      join auth.users u on u.id = a.user_id
     order by a.created_at;
end $$;

create or replace function public.shop_admin_add(p_email text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.shop_is_admin() then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_id is null then raise exception 'ไม่พบบัญชีอีเมลนี้ ผู้ใช้ต้องสมัครสมาชิกก่อน'; end if;
  insert into public.shop_admins (user_id) values (v_id) on conflict do nothing;
  return v_id;
end $$;

create or replace function public.shop_admin_remove(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.shop_is_admin() then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  if p_user_id = auth.uid() then raise exception 'ลบสิทธิ์ของตัวเองไม่ได้'; end if;
  if (select count(*) from public.shop_admins) <= 1 then raise exception 'ต้องมี Admin อย่างน้อย 1 คน'; end if;
  delete from public.shop_admins where user_id = p_user_id;
end $$;

revoke all on function public.shop_admin_list(), public.shop_admin_add(text), public.shop_admin_remove(uuid) from public, anon;
grant execute on function public.shop_admin_list(), public.shop_admin_add(text), public.shop_admin_remove(uuid) to authenticated;

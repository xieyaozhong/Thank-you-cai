-- 謝謝你，菜！雲端訂單資料庫
-- 可重複執行：建立或升級攤主工作台所需的資料表、索引、函式與 RLS 權限。
create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create table if not exists public.owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  order_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text not null check (char_length(customer_name) between 1 and 30),
  contact text not null check (char_length(contact) between 1 and 50),
  pickup_slot text not null check (char_length(pickup_slot) between 1 and 40),
  note text not null default '' check (char_length(note) <= 120),
  owner_note text not null default '' check (char_length(owner_note) <= 500),
  priority boolean not null default false,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal integer not null check (subtotal between 0 and 1000000),
  delivery integer not null check (delivery between 0 and 100000),
  total integer not null check (total between 0 and 1100000),
  customer_token uuid not null,
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','completed','cancelled'))
);

alter table public.orders add column if not exists owner_note text not null default '';
alter table public.orders add column if not exists priority boolean not null default false;

-- Add upgrade constraints only when they do not already exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_owner_note_length') then
    alter table public.orders add constraint orders_owner_note_length check (char_length(owner_note) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_items_count') then
    alter table public.orders add constraint orders_items_count check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40);
  end if;
end $$;

create index if not exists orders_store_created_idx on public.orders(store_id, created_at desc);
create index if not exists orders_store_status_idx on public.orders(store_id, status);
create index if not exists orders_store_priority_idx on public.orders(store_id, priority desc, created_at desc);

create table if not exists public.store_settings (
  store_id text primary key,
  announcement text not null default '' check (char_length(announcement) <= 120),
  products jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

alter table public.owner_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.store_settings enable row level security;

create or replace function public.is_store_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_accounts
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_owner() from public, anon;
grant execute on function public.is_store_owner() to authenticated;

revoke all on public.owner_accounts from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.store_settings from anon, authenticated;

grant insert on public.orders to anon;
grant select, update on public.orders to authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

drop policy if exists "customers can create orders" on public.orders;
create policy "customers can create orders"
on public.orders for insert to anon
with check (
  store_id = 'thank-you-cai'
  and status = 'pending'
  and priority = false
  and owner_note = ''
  and jsonb_array_length(items) between 1 and 40
);

drop policy if exists "registered owners can read orders" on public.orders;
create policy "registered owners can read orders"
on public.orders for select to authenticated
using ((select public.is_store_owner()));

drop policy if exists "registered owners can update orders" on public.orders;
create policy "registered owners can update orders"
on public.orders for update to authenticated
using ((select public.is_store_owner()))
with check (
  store_id = 'thank-you-cai'
  and (select public.is_store_owner())
);

drop policy if exists "everyone can read store settings" on public.store_settings;
create policy "everyone can read store settings"
on public.store_settings for select to anon, authenticated
using (store_id = 'thank-you-cai');

drop policy if exists "registered owners can insert store settings" on public.store_settings;
create policy "registered owners can insert store settings"
on public.store_settings for insert to authenticated
with check (store_id = 'thank-you-cai' and (select public.is_store_owner()));

drop policy if exists "registered owners can update store settings" on public.store_settings;
create policy "registered owners can update store settings"
on public.store_settings for update to authenticated
using (store_id = 'thank-you-cai' and (select public.is_store_owner()))
with check (store_id = 'thank-you-cai' and (select public.is_store_owner()));

insert into public.store_settings(store_id)
values ('thank-you-cai')
on conflict (store_id) do nothing;

-- 啟用步驟
-- 1. 在 Supabase Authentication 建立攤主帳號。
-- 2. 到 Authentication > Users 複製該使用者 UUID。
-- 3. 執行：insert into public.owner_accounts(user_id) values ('你的使用者 UUID') on conflict do nothing;
-- 4. 在 GitHub Actions Variables 設定 SUPABASE_URL 與 SUPABASE_PUBLISHABLE_KEY。
-- 5. 重新執行 GitHub Pages workflow。

-- 謝謝你，菜！雲端訂單資料庫（在 Supabase SQL Editor 執行）
create extension if not exists pgcrypto;

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
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal integer not null check (subtotal >= 0),
  delivery integer not null check (delivery >= 0),
  total integer not null check (total >= 0),
  customer_token uuid not null,
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','completed','cancelled'))
);
create index if not exists orders_store_created_idx on public.orders(store_id, created_at desc);
create index if not exists orders_store_status_idx on public.orders(store_id, status);

create table if not exists public.store_settings (
  store_id text primary key,
  announcement text not null default '' check (char_length(announcement) <= 120),
  products jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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
  select exists (select 1 from public.owner_accounts where user_id = (select auth.uid()));
$$;
revoke all on function public.is_store_owner() from public;
grant execute on function public.is_store_owner() to authenticated;

revoke all on public.owner_accounts from anon, authenticated;
grant select, insert on public.orders to anon;
grant select, update on public.orders to authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

create policy "customers can create orders"
on public.orders for insert to anon
with check (store_id = 'thank-you-cai' and status = 'pending');

create policy "registered owners can read orders"
on public.orders for select to authenticated
using ((select public.is_store_owner()));

create policy "registered owners can update orders"
on public.orders for update to authenticated
using ((select public.is_store_owner()))
with check ((select public.is_store_owner()));

create policy "everyone can read store settings"
on public.store_settings for select to anon, authenticated using (store_id = 'thank-you-cai');

create policy "registered owners can insert store settings"
on public.store_settings for insert to authenticated
with check (store_id = 'thank-you-cai' and (select public.is_store_owner()));

create policy "registered owners can update store settings"
on public.store_settings for update to authenticated
using (store_id = 'thank-you-cai' and (select public.is_store_owner()))
with check (store_id = 'thank-you-cai' and (select public.is_store_owner()));

insert into public.store_settings(store_id) values ('thank-you-cai') on conflict do nothing;

-- 1. 在 Supabase Authentication 建立攤主帳號。
-- 2. 到 Authentication > Users 複製該使用者 UUID。
-- 3. 執行：insert into public.owner_accounts(user_id) values ('你的使用者 UUID');

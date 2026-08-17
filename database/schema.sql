-- WangStore production schema for Supabase PostgreSQL
-- Jalankan seluruh file ini melalui Supabase SQL Editor pada project baru.
begin;
create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('owner','admin','staff','customer')),
  rank smallint not null unique check (rank between 0 and 3),
  created_at timestamptz not null default now()
);
insert into public.roles (name,rank) values ('customer',0),('staff',1),('admin',2),('owner',3)
on conflict (name) do update set rank=excluded.rank;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  email_verified boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  whatsapp text not null default '' check (whatsapp = '' or whatsapp ~ '^\+?[0-9]{9,15}$'),
  role_id uuid not null references public.roles(id),
  two_factor_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role_id);

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
declare customer_role uuid;
begin
  select id into customer_role from public.roles where name='customer';
  insert into public.users(id,email,email_verified) values(new.id,coalesce(new.email,''),new.email_confirmed_at is not null)
  on conflict(id) do update set email=excluded.email,email_verified=excluded.email_verified,updated_at=now();
  insert into public.profiles(id,name,whatsapp,role_id) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),'Pelanggan'),coalesce(new.raw_user_meta_data->>'whatsapp',''),customer_role)
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email_confirmed_at on auth.users for each row execute function public.handle_new_auth_user();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  description text not null, tier text check(tier in ('low','medium','high')),
  service_type text not null check(service_type in ('minecraft','vps','dedicated','panel','other')),
  status text not null check(status in ('available','ongoing','maintenance','inactive')),
  visibility boolean not null default true, renewable boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists products_visible_idx on public.products(visibility,status) where deleted_at is null;
insert into public.products(name,slug,description,tier,service_type,status,visibility,renewable,metadata) values
('Minecraft Hosting Low','minecraft-low','Konfigurasi fleksibel untuk memulai server Minecraft sesuai kebutuhan CPU, RAM, dan penyimpanan.','low','minecraft','available',true,true,'{"configuration":"custom"}'),
('Minecraft Hosting Medium','minecraft-medium','Pilihan paket yang sedang dipersiapkan dan belum tersedia untuk pemesanan.','medium','minecraft','ongoing',true,true,'{"configuration":"package"}'),
('Minecraft Hosting High','minecraft-high','Paket tetap dengan prosesor berperforma tinggi untuk beban kerja Minecraft yang lebih intensif.','high','minecraft','available',true,true,'{"configuration":"package"}')
on conflict(slug) do nothing;

create table if not exists public.packages (
  id text primary key, product_id uuid references public.products(id) on delete cascade,
  name text not null, cpu integer not null check(cpu>0), ram integer not null check(ram>0),
  storage integer not null check(storage>0 and storage<=160), price bigint not null check(price>0),
  status text not null default 'available' check(status in ('available','ongoing','maintenance','inactive')),
  popular boolean not null default false, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.packages(id,product_id,name,cpu,ram,storage,price,status,popular)
select v.id,p.id,v.name,v.cpu,v.ram,v.storage,v.price,'available',v.popular
from public.products p cross join (values
('high-2c4g','High 2 Inti / 4 GB',2,4,30,300000,false),
('high-3c6g','High 3 Inti / 6 GB',3,6,40,420000,false),
('high-4c8g','High 4 Inti / 8 GB',4,8,50,600000,true),
('high-6c12g','High 6 Inti / 12 GB',6,12,60,850000,false),
('high-8c16g','High 8 Inti / 16 GB',8,16,70,1100000,false),
('high-10c32g','High 10 Inti / 32 GB',10,32,110,2100000,false)
) as v(id,name,cpu,ram,storage,price,popular) where p.slug='minecraft-high'
on conflict(id) do update set price=excluded.price,cpu=excluded.cpu,ram=excluded.ram,storage=excluded.storage,popular=excluded.popular;
create index if not exists packages_product_idx on public.packages(product_id,status);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete cascade,
  key text not null, value numeric(14,2) not null check(value>=0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_id,key)
);
insert into public.pricing_rules(product_id,key,value)
select p.id,v.key,v.value from public.products p cross join (values ('base',5000),('per_core',7000),('per_gb_ram',4500),('per_gb_storage',300),('rounding',500),('minimum',45000)) v(key,value)
where p.slug='minecraft-low' on conflict(product_id,key) do update set value=excluded.value;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  discount_type text not null check(discount_type in ('percentage','fixed')),
  discount_value numeric(14,2) not null check(discount_value>0), minimum_order bigint not null default 0 check(minimum_order>=0),
  expires_at timestamptz, maximum_usage integer check(maximum_usage is null or maximum_usage>0),
  usage_count integer not null default 0 check(usage_count>=0), usage_per_customer integer not null default 1 check(usage_per_customer>0),
  applicable_product_id uuid references public.products(id), applicable_tier text check(applicable_tier in ('low','medium','high')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists coupons_active_idx on public.coupons(code,active,expires_at);

create table if not exists public.orders (
  id text primary key, customer_id uuid not null references public.users(id) on delete restrict,
  name text not null, whatsapp text not null, email text not null, server_name text not null, note text not null default '',
  tier text not null check(tier in ('low','medium','high')), package_id text references public.packages(id),
  cpu integer not null check(cpu>0), ram integer not null check(ram>0), storage integer not null check(storage>0 and storage<=160),
  subtotal bigint not null check(subtotal>0), discount bigint not null default 0 check(discount>=0), total bigint not null check(total>0),
  coupon_id uuid references public.coupons(id), coupon_code text,
  status text not null default 'pending' check(status in ('pending','awaiting_payment','paid','processing','completed','cancelled','expired','refunded')),
  access_token_hash text not null, payment_provider text not null default 'manual', payment_reference text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_status_idx on public.orders(status,created_at desc);
create index if not exists orders_email_idx on public.orders(lower(email));
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id text not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id), package_id text references public.packages(id), description text not null,
  quantity integer not null default 1 check(quantity>0), unit_price bigint not null check(unit_price>0), metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
  order_id text not null unique references public.orders(id) on delete cascade, customer_key text not null,
  created_at timestamptz not null default now(), unique(coupon_id,order_id)
);
create index if not exists coupon_usages_customer_idx on public.coupon_usages(coupon_id,customer_key);

create table if not exists public.saved_configurations (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.users(id) on delete cascade,
  name text not null, tier text not null check(tier in ('low','medium','high')), package_id text references public.packages(id),
  cpu integer not null check(cpu>0), ram integer not null check(ram>0), storage integer not null check(storage between 1 and 160),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists saved_config_customer_idx on public.saved_configurations(customer_id,updated_at desc);

create table if not exists public.tickets (
  id text primary key, customer_id uuid references public.users(id) on delete set null, name text not null, email text not null,
  subject text not null, message text not null,
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  assigned_to uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tickets_customer_idx on public.tickets(customer_id,created_at desc);
create index if not exists tickets_status_idx on public.tickets(status,priority,created_at);
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(), ticket_id text not null references public.tickets(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null, message text not null,
  internal boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages(ticket_id,created_at);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.users(id) on delete cascade,
  service_id uuid, title text not null, message text not null, channel text not null default 'dashboard',
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_customer_idx on public.notifications(customer_id,created_at desc);

create table if not exists public.blog_categories(id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique,created_at timestamptz not null default now());
create table if not exists public.blog_tags(id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique,created_at timestamptz not null default now());
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,excerpt text not null,content text not null,
  category text not null,tags text[] not null default '{}',author text not null,status text not null check(status in ('draft','published')),
  published_at timestamptz,seo_title text not null,seo_description text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists blog_published_idx on public.blog_posts(status,published_at desc);
create index if not exists blog_search_idx on public.blog_posts using gin(to_tsvector('simple',title||' '||excerpt||' '||content||' '||category||' '||array_to_string(tags,' ')));
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,excerpt text not null,content text not null,
  category text not null check(category in ('Memulai','Pemesanan','Pembayaran','Minecraft','Server','Pemecahan Masalah','Akun','Kebijakan')),
  tags text[] not null default '{}',author text not null,status text not null check(status in ('draft','published')),
  published_at timestamptz,seo_title text not null,seo_description text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists knowledge_published_idx on public.knowledge_articles(status,published_at desc);
create index if not exists knowledge_search_idx on public.knowledge_articles using gin(to_tsvector('simple',title||' '||excerpt||' '||content||' '||category||' '||array_to_string(tags,' ')));
create table if not exists public.faq_items(id uuid primary key default gen_random_uuid(),question text not null,answer text not null,category text not null,sort_order integer not null default 0,published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.testimonials(id uuid primary key default gen_random_uuid(),customer_name text not null,quote text not null,source text not null,verified boolean not null default false,published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(not published or verified));
create table if not exists public.pages(id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,content text not null,status text not null check(status in ('draft','published')),seo_title text not null,seo_description text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.legal_documents(id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,content text not null,version text not null,status text not null check(status in ('draft','published')),seo_title text not null,seo_description text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create table if not exists public.incidents(
  id uuid primary key default gen_random_uuid(),title text not null,status text not null check(status in ('investigating','identified','monitoring','resolved')),
  impact text not null check(impact in ('none','minor','major','critical')),message text not null,started_at timestamptz not null,resolved_at timestamptz,
  published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.maintenance_windows(id uuid primary key default gen_random_uuid(),title text not null,message text not null,starts_at timestamptz not null,ends_at timestamptz,status text not null check(status in ('scheduled','in_progress','completed','cancelled')),published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.announcements(id uuid primary key default gen_random_uuid(),title text not null,message text not null,starts_at timestamptz not null,ends_at timestamptz,active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.app_settings(key text primary key,value text not null,updated_at timestamptz not null default now());
insert into public.app_settings(key,value) values
('whatsapp_number',''),('contact_email',''),('discord_url',''),('maintenance_enabled','false'),('maintenance_title','Pemeliharaan Terjadwal'),('maintenance_message','Platform sedang menjalani pemeliharaan. Silakan kembali beberapa saat lagi.'),('maintenance_restoration',''),('maintenance_allowed_paths','/status,/login,/api/auth') on conflict(key) do nothing;

create table if not exists public.vps_locations(
  id uuid primary key default gen_random_uuid(),name text not null unique,country text not null,city text not null,
  status text not null check(status in ('active','maintenance','inactive')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.vps_packages(
  id uuid primary key default gen_random_uuid(),product_id uuid references public.products(id),name text not null,slug text not null unique,
  cpu integer not null check(cpu>0),ram integer not null check(ram>0),storage integer not null check(storage>0),bandwidth text not null,
  ipv4_available boolean not null default false,location_id uuid not null references public.vps_locations(id),virtualization text not null,
  price bigint not null check(price>0),billing_period text not null check(billing_period in ('monthly','quarterly','yearly')),
  duration_days integer not null check(duration_days>0),renewable boolean not null default true,
  status text not null check(status in ('available','sold_out','maintenance','inactive')),visibility boolean not null default false,
  description text not null,features text[] not null default '{}',deleted_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists vps_packages_catalog_idx on public.vps_packages(visibility,status,price) where deleted_at is null;
create index if not exists vps_packages_location_idx on public.vps_packages(location_id);

create table if not exists public.service_instances(
  id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.users(id),order_id text not null references public.orders(id),
  product_id uuid not null references public.products(id),package_id text references public.packages(id),service_type text not null,
  status text not null check(status in ('pending','scheduled','active','suspended','expired','cancelled','terminated')),
  activation_at timestamptz not null,expires_at timestamptz not null,renewable boolean not null default true,price bigint not null check(price>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(expires_at>activation_at)
);
alter table public.notifications drop constraint if exists notifications_service_id_fkey;
alter table public.notifications add constraint notifications_service_id_fkey foreign key(service_id) references public.service_instances(id) on delete cascade;
create unique index if not exists services_one_per_order_idx on public.service_instances(order_id);
create index if not exists services_customer_idx on public.service_instances(customer_id,status,expires_at);
create index if not exists services_lifecycle_idx on public.service_instances(status,activation_at,expires_at);
create table if not exists public.service_renewals(
  id uuid primary key default gen_random_uuid(),service_id uuid not null references public.service_instances(id) on delete cascade,
  order_id text references public.orders(id),external_order_id text unique,duration integer not null check(duration>0),
  old_expires_at timestamptz not null,new_expires_at timestamptz not null,price bigint not null check(price>0),
  status text not null check(status in ('pending','completed','cancelled')),payment_reference text,
  created_at timestamptz not null default now(),completed_at timestamptz,
  check(new_expires_at>old_expires_at)
);
alter table public.service_renewals add column if not exists payment_reference text;
create index if not exists renewals_service_idx on public.service_renewals(service_id,created_at desc);
create unique index if not exists renewals_one_pending_per_service_idx on public.service_renewals(service_id) where status='pending';
create table if not exists public.service_reminders(
  id uuid primary key default gen_random_uuid(),service_id uuid not null references public.service_instances(id) on delete cascade,
  customer_id uuid not null references public.users(id),reminder_type text not null,expires_at timestamptz not null,scheduled_at timestamptz not null,sent_at timestamptz,
  status text not null check(status in ('scheduled','sent','failed','skipped')),created_at timestamptz not null default now()
);
alter table public.service_reminders add column if not exists expires_at timestamptz;
update public.service_reminders r set expires_at=s.expires_at from public.service_instances s where r.service_id=s.id and r.expires_at is null;
alter table public.service_reminders alter column expires_at set not null;
alter table public.service_reminders drop constraint if exists service_reminders_service_id_reminder_type_key;
create unique index if not exists reminders_service_cycle_unique on public.service_reminders(service_id,reminder_type,expires_at);
create index if not exists reminders_schedule_idx on public.service_reminders(status,scheduled_at);

create table if not exists public.audit_logs(
  id uuid primary key default gen_random_uuid(),actor_id uuid references public.users(id) on delete set null,action text not null,
  resource text not null,resource_id text,ip text not null default '',metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists audit_resource_idx on public.audit_logs(resource,resource_id,created_at desc);
create index if not exists audit_actor_idx on public.audit_logs(actor_id,created_at desc);
create table if not exists public.rate_limits(key text primary key,count integer not null,reset_at timestamptz not null,updated_at timestamptz not null default now());

create or replace function public.current_role_rank() returns smallint language sql stable security definer set search_path=public as $$
  select coalesce((select r.rank from profiles p join roles r on r.id=p.role_id where p.id=auth.uid()),0)::smallint
$$;
create or replace function public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare row_count integer; deadline timestamptz;
begin
  insert into rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set count=case when rate_limits.reset_at<=now() then 1 else rate_limits.count+1 end,reset_at=case when rate_limits.reset_at<=now() then now()+make_interval(secs=>p_window_seconds) else rate_limits.reset_at end,updated_at=now()
  returning count,reset_at into row_count,deadline;
  return jsonb_build_object('allowed',row_count<=p_limit,'retryAfter',greatest(1,extract(epoch from(deadline-now()))::integer));
end $$;

create or replace function public.validate_coupon(p_code text,p_subtotal bigint,p_tier text,p_customer_key text)
returns table(code text,discount bigint) language plpgsql security definer set search_path=public as $$
declare c coupons%rowtype; user_uses integer; raw_discount numeric;
begin
  select * into c from coupons where coupons.code=upper(p_code) for update;
  if not found then raise exception 'Kupon tidak ditemukan.'; end if;
  if not c.active then raise exception 'Kupon tidak aktif.'; end if;
  if c.expires_at is not null and c.expires_at<=now() then raise exception 'Masa berlaku kupon telah berakhir.'; end if;
  if c.maximum_usage is not null and c.usage_count>=c.maximum_usage then raise exception 'Batas penggunaan kupon tercapai.'; end if;
  select count(*) into user_uses from coupon_usages where coupon_id=c.id and customer_key=p_customer_key;
  if user_uses>=c.usage_per_customer then raise exception 'Batas penggunaan pelanggan tercapai.'; end if;
  if p_subtotal<c.minimum_order then raise exception 'Nilai minimum pesanan belum terpenuhi.'; end if;
  if c.applicable_tier is not null and c.applicable_tier<>p_tier then raise exception 'Kupon tidak berlaku untuk tier ini.'; end if;
  raw_discount:=case when c.discount_type='percentage' then p_subtotal*c.discount_value/100 else c.discount_value end;
  return query select c.code,least(p_subtotal,greatest(0,round(raw_discount)))::bigint;
end $$;

create or replace function public.create_order_transaction(
  p_order_id text,p_customer_id uuid,p_name text,p_whatsapp text,p_email text,p_server_name text,p_note text,p_tier text,p_package_id text,
  p_cpu integer,p_ram integer,p_storage integer,p_subtotal bigint,p_coupon_code text,p_access_token_hash text,p_ip text
) returns setof public.orders language plpgsql security definer set search_path=public as $$
declare c coupons%rowtype; discount_value bigint:=0; expected_subtotal bigint:=0; created_order orders%rowtype; customer_key text:=coalesce(p_customer_id::text,lower(p_email)); product_row products%rowtype; package_row packages%rowtype;
begin
  if p_customer_id is null then raise exception 'Pesanan harus terhubung ke akun pelanggan.'; end if;
  if p_tier not in ('low','medium','high') then raise exception 'Tier tidak dikenal.'; end if;
  select * into product_row from products where tier=p_tier and deleted_at is null;
  if not found or product_row.status<>'available' then raise exception 'Produk tidak tersedia.'; end if;
  if p_storage>160 or p_storage<=0 or p_subtotal<=0 then raise exception 'Konfigurasi atau harga tidak valid.'; end if;
  if p_tier='low' then
    if p_package_id is not null or p_cpu<2 or p_cpu>16 or p_ram<4 or p_ram>32 or mod(p_ram-4,2)<>0 or p_storage<20 or mod(p_storage-20,10)<>0 then raise exception 'Konfigurasi Low tidak valid.'; end if;
    expected_subtotal:=greatest(45000,(round((5000+p_cpu*7000+p_ram*4500+p_storage*300)::numeric/500)*500)::bigint);
    if p_subtotal<>expected_subtotal then raise exception 'Harga Low tidak valid.'; end if;
  else
    select * into package_row from packages where id=p_package_id and product_id=product_row.id and status='available';
    if not found then raise exception 'Paket tidak tersedia.'; end if;
    if p_cpu<>package_row.cpu or p_ram<>package_row.ram or p_storage<>package_row.storage or p_subtotal<>package_row.price then raise exception 'Konfigurasi atau harga paket tidak valid.'; end if;
  end if;
  if nullif(p_coupon_code,'') is not null then
    select * into c from coupons where code=upper(p_coupon_code) for update;
    if not found then raise exception 'Kupon tidak ditemukan.'; end if;
    select v.discount into discount_value from validate_coupon(c.code,p_subtotal,p_tier,customer_key) v;
  end if;
  insert into orders(id,customer_id,name,whatsapp,email,server_name,note,tier,package_id,cpu,ram,storage,subtotal,discount,total,coupon_id,coupon_code,status,access_token_hash)
  values(p_order_id,p_customer_id,p_name,p_whatsapp,lower(p_email),p_server_name,p_note,p_tier,p_package_id,p_cpu,p_ram,p_storage,p_subtotal,discount_value,greatest(1,p_subtotal-discount_value),c.id,c.code,'pending',p_access_token_hash)
  returning * into created_order;
  insert into order_items(order_id,product_id,package_id,description,quantity,unit_price,metadata)
  values(created_order.id,product_row.id,p_package_id,product_row.name,1,p_subtotal,jsonb_build_object('tier',p_tier,'cpu',p_cpu,'ram',p_ram,'storage',p_storage));
  if c.id is not null then
    update coupons set usage_count=usage_count+1,updated_at=now() where id=c.id;
    insert into coupon_usages(coupon_id,order_id,customer_key) values(c.id,created_order.id,customer_key);
  end if;
  insert into audit_logs(actor_id,action,resource,resource_id,ip,metadata) values(p_customer_id,'create','order',created_order.id,p_ip,jsonb_build_object('tier',p_tier,'total',created_order.total));
  return next created_order;
end $$;

create or replace function public.enforce_service_lifecycle() returns trigger language plpgsql as $$
begin
  if new.expires_at<=now() and new.status not in ('cancelled','terminated') then new.status='expired';
  elsif new.activation_at>now() and new.status not in ('cancelled','terminated','suspended') then new.status='scheduled';
  elsif new.activation_at<=now() and new.expires_at>now() and new.status in ('pending','scheduled','expired') then new.status='active'; end if;
  new.updated_at=now(); return new;
end $$;
drop trigger if exists service_lifecycle_before_write on public.service_instances;
create trigger service_lifecycle_before_write before insert or update on public.service_instances for each row execute function public.enforce_service_lifecycle();

create or replace function public.transition_order_status(
  p_order_id text,
  p_status text,
  p_payment_reference text,
  p_reason text,
  p_actor_id uuid,
  p_ip text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  order_row public.orders%rowtype;
  product_row public.products%rowtype;
  service_row public.service_instances%rowtype;
  changed_at timestamptz := clock_timestamp();
  transition_allowed boolean := false;
begin
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Alasan perubahan wajib diisi.'; end if;
  if p_status not in ('pending','awaiting_payment','paid','processing','completed','cancelled','expired','refunded') then
    raise exception 'Status pesanan tidak valid.';
  end if;

  select * into order_row from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  select * into service_row from public.service_instances where order_id=order_row.id;
  if order_row.status=p_status then
    return jsonb_build_object('orderId',order_row.id,'serviceId',service_row.id);
  end if;

  transition_allowed := case order_row.status
    when 'pending' then p_status in ('awaiting_payment','paid','cancelled','expired')
    when 'awaiting_payment' then p_status in ('pending','paid','cancelled','expired')
    when 'paid' then p_status in ('processing','completed','refunded')
    when 'processing' then p_status in ('completed','refunded')
    when 'completed' then p_status='refunded'
    else false
  end;
  if not transition_allowed then
    raise exception 'Status pesanan tidak dapat diubah dari % menjadi %.',order_row.status,p_status;
  end if;

  if p_status='paid' then
    if length(trim(coalesce(p_payment_reference,''))) < 3 then raise exception 'Referensi pembayaran wajib diisi.'; end if;
    if order_row.customer_id is null then raise exception 'Pesanan harus terhubung ke akun pelanggan sebelum pembayaran dikonfirmasi.'; end if;
    if service_row.id is null then
      select * into product_row from public.products where slug='minecraft-'||order_row.tier and deleted_at is null;
      if not found then raise exception 'Produk pesanan tidak ditemukan.'; end if;
      insert into public.service_instances(
        customer_id,order_id,product_id,package_id,service_type,status,activation_at,expires_at,renewable,price
      ) values(
        order_row.customer_id,order_row.id,product_row.id,order_row.package_id,product_row.service_type,'active',
        changed_at,changed_at + interval '30 days',product_row.renewable,order_row.subtotal
      ) returning * into service_row;
      insert into public.notifications(customer_id,service_id,title,message)
      values(
        order_row.customer_id,service_row.id,'Layanan berhasil dibuat',
        'Pembayaran pesanan '||order_row.id||' telah dikonfirmasi. Layanan '||service_row.id||' aktif hingga '||service_row.expires_at||'.'
      );
    end if;
    update public.orders set status=p_status,payment_reference=trim(p_payment_reference),updated_at=changed_at where id=order_row.id;
  else
    if p_status in ('processing','completed') and service_row.id is null then
      raise exception 'Pesanan terbayar belum memiliki layanan.';
    end if;
    update public.orders set status=p_status,updated_at=changed_at where id=order_row.id;
  end if;

  insert into public.audit_logs(actor_id,action,resource,resource_id,ip,metadata)
  values(
    p_actor_id,case when p_status='paid' then 'confirm_payment' else 'transition' end,'order',order_row.id,coalesce(p_ip,''),
    jsonb_build_object(
      'previousStatus',order_row.status,'status',p_status,'reason',trim(p_reason),
      'paymentReference',case when p_status='paid' then trim(p_payment_reference) else order_row.payment_reference end,
      'serviceId',service_row.id
    )
  );
  return jsonb_build_object('orderId',order_row.id,'serviceId',service_row.id);
end $$;

create or replace function public.complete_service_renewal(
  p_renewal_id uuid,
  p_actor_id uuid,
  p_ip text,
  p_payment_reference text,
  p_reason text
) returns setof public.service_renewals language plpgsql security definer set search_path=public as $$
declare
  renewal_row public.service_renewals%rowtype;
  service_row public.service_instances%rowtype;
  confirmed_at timestamptz := clock_timestamp();
  calculated_expiration timestamptz;
begin
  if length(trim(coalesce(p_payment_reference,''))) < 3 then raise exception 'Referensi pembayaran wajib diisi.'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Alasan konfirmasi wajib diisi.'; end if;
  select * into renewal_row from public.service_renewals where id=p_renewal_id for update;
  if not found then raise exception 'Perpanjangan tidak ditemukan.'; end if;
  if renewal_row.status='cancelled' then raise exception 'Perpanjangan yang dibatalkan tidak dapat dikonfirmasi.'; end if;
  if renewal_row.status='completed' then return query select * from public.service_renewals where id=p_renewal_id; return; end if;
  select * into service_row from public.service_instances where id=renewal_row.service_id for update;
  if not found then raise exception 'Layanan untuk perpanjangan tidak ditemukan.'; end if;
  if service_row.status in ('cancelled','terminated') then raise exception 'Status layanan tidak dapat diperpanjang.'; end if;
  calculated_expiration := greatest(service_row.expires_at,confirmed_at) + renewal_row.duration * interval '1 day';
  update public.service_instances set
    activation_at=case when service_row.expires_at<=confirmed_at then confirmed_at else service_row.activation_at end,
    expires_at=calculated_expiration,
    status=case when service_row.status='suspended' then 'suspended' else 'active' end,
    updated_at=confirmed_at
  where id=service_row.id;
  update public.service_renewals set status='completed',new_expires_at=calculated_expiration,
    payment_reference=trim(p_payment_reference),completed_at=confirmed_at
  where id=p_renewal_id;
  insert into public.audit_logs(actor_id,action,resource,resource_id,ip,metadata)
  values(p_actor_id,'confirm','service_renewal',p_renewal_id::text,coalesce(p_ip,''),jsonb_build_object(
    'serviceId',service_row.id,'paymentReference',trim(p_payment_reference),'reason',trim(p_reason),'newExpiresAt',calculated_expiration
  ));
  return query select * from public.service_renewals where id=p_renewal_id;
end $$;

create or replace function public.process_service_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path=public as $$
declare made integer:=0; s service_instances%rowtype; reminder text; days_left integer;
begin
  update service_instances set status='expired',updated_at=p_now where expires_at<=p_now and status not in ('expired','cancelled','terminated');
  update service_instances set status='active',updated_at=p_now where activation_at<=p_now and expires_at>p_now and status='scheduled';
  for s in select * from service_instances where status not in ('cancelled','terminated') loop
    days_left:=greatest(0,ceil(extract(epoch from(s.expires_at-p_now))/86400));
    reminder:=case days_left when 7 then 'expires_7_days' when 3 then 'expires_3_days' when 1 then 'expires_1_day' when 0 then 'expired' else null end;
    if reminder is not null then
      insert into service_reminders(service_id,customer_id,reminder_type,expires_at,scheduled_at,sent_at,status) values(s.id,s.customer_id,reminder,s.expires_at,p_now,p_now,'sent') on conflict(service_id,reminder_type,expires_at) do nothing;
      if found then insert into notifications(customer_id,service_id,title,message) values(s.customer_id,s.id,case when reminder='expired' then 'Masa layanan berakhir' else 'Pengingat masa layanan' end,case when reminder='expired' then 'Layanan '||s.id||' telah berakhir.' else 'Layanan '||s.id||' akan berakhir dalam '||days_left||' hari.' end); made:=made+1; end if;
    end if;
  end loop;
  return made;
end $$;

-- Row Level Security. Service-role server code bypasses RLS; browser clients tetap dibatasi.
do $$ declare t text; begin foreach t in array array['users','profiles','orders','order_items','saved_configurations','tickets','ticket_messages','notifications','coupons','coupon_usages','service_instances','service_renewals','service_reminders','audit_logs','products','packages','pricing_rules','blog_posts','knowledge_articles','faq_items','testimonials','pages','legal_documents','incidents','maintenance_windows','announcements','app_settings','vps_packages','vps_locations'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy users_self_read on public.users for select using(id=auth.uid() or current_role_rank()>=1);
create policy profiles_self_read on public.profiles for select using(id=auth.uid() or current_role_rank()>=1);
create policy profiles_self_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy products_public_read on public.products for select using(visibility and status<>'inactive' and deleted_at is null);
create policy packages_public_read on public.packages for select using(status<>'inactive');
create policy vps_public_read on public.vps_packages for select using(visibility and status<>'inactive' and deleted_at is null);
create policy vps_locations_public_read on public.vps_locations for select using(status<>'inactive');
create policy blog_public_read on public.blog_posts for select using(status='published' and published_at<=now());
create policy knowledge_public_read on public.knowledge_articles for select using(status='published' and published_at<=now());
create policy faq_public_read on public.faq_items for select using(published);
create policy testimonials_public_read on public.testimonials for select using(published and verified);
create policy pages_public_read on public.pages for select using(status='published');
create policy legal_public_read on public.legal_documents for select using(status='published');
create policy incidents_public_read on public.incidents for select using(published);
create policy maintenance_public_read on public.maintenance_windows for select using(published);
create policy announcements_public_read on public.announcements for select using(active and starts_at<=now() and (ends_at is null or ends_at>now()));
create policy orders_owner_read on public.orders for select using(customer_id=auth.uid() or current_role_rank()>=1);
create policy order_items_owner_read on public.order_items for select using(exists(select 1 from orders o where o.id=order_id and(o.customer_id=auth.uid() or current_role_rank()>=1)));
create policy saved_config_owner_all on public.saved_configurations for all using(customer_id=auth.uid() or current_role_rank()>=1) with check(customer_id=auth.uid() or current_role_rank()>=1);
create policy tickets_owner_read on public.tickets for select using(customer_id=auth.uid() or current_role_rank()>=1);
create policy ticket_messages_owner_read on public.ticket_messages for select using(exists(select 1 from tickets t where t.id=ticket_id and(t.customer_id=auth.uid() or current_role_rank()>=1)) and(not internal or current_role_rank()>=1));
create policy notifications_owner_read on public.notifications for select using(customer_id=auth.uid() or current_role_rank()>=1);
create policy services_owner_read on public.service_instances for select using(customer_id=auth.uid() or current_role_rank()>=1);
create policy renewals_owner_read on public.service_renewals for select using(exists(select 1 from service_instances s where s.id=service_id and(s.customer_id=auth.uid() or current_role_rank()>=1)));
create policy reminders_owner_read on public.service_reminders for select using(customer_id=auth.uid() or current_role_rank()>=1);
create policy audit_admin_read on public.audit_logs for select using(current_role_rank()>=2);

-- Write policies for authenticated staff; API tetap melakukan RBAC minimum role per resource.
create policy staff_ticket_update on public.tickets for update using(current_role_rank()>=1) with check(current_role_rank()>=1);
create policy admin_products_all on public.products for all using(current_role_rank()>=2) with check(current_role_rank()>=2);
create policy admin_packages_all on public.packages for all using(current_role_rank()>=2) with check(current_role_rank()>=2);
create policy admin_vps_all on public.vps_packages for all using(current_role_rank()>=2) with check(current_role_rank()>=2);
create policy admin_locations_all on public.vps_locations for all using(current_role_rank()>=2) with check(current_role_rank()>=2);
create policy admin_services_all on public.service_instances for all using(current_role_rank()>=2) with check(current_role_rank()>=2);

revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.validate_coupon(text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.create_order_transaction(text,uuid,text,text,text,text,text,text,text,integer,integer,integer,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.transition_order_status(text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_service_renewal(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.process_service_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
grant execute on function public.validate_coupon(text,bigint,text,text) to service_role;
grant execute on function public.create_order_transaction(text,uuid,text,text,text,text,text,text,text,integer,integer,integer,bigint,text,text,text) to service_role;
grant execute on function public.transition_order_status(text,text,text,text,uuid,text) to service_role;
grant execute on function public.complete_service_renewal(uuid,uuid,text,text,text) to service_role;
grant execute on function public.process_service_reminders(timestamptz) to service_role;
commit;

-- Setelah schema dijalankan, jadikan akun pertama sebagai Owner secara eksplisit:
-- update public.profiles set role_id=(select id from public.roles where name='owner') where id='<AUTH_USER_UUID>';

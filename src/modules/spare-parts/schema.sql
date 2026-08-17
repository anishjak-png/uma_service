-- Isolated spare-parts billing tables. Do not ALTER Uma Service JobCard/Customer tables.

create extension if not exists vector with schema extensions;

create table if not exists spa_spare_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  category text not null default '',
  brand text not null default '',
  selling_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists spa_spare_part_images (
  id uuid primary key default gen_random_uuid(),
  spare_part_id uuid not null references spa_spare_parts(id) on delete cascade,
  storage_path text not null,
  sort_order int not null check (sort_order between 1 and 3),
  embedding extensions.vector(1024),
  embedding_model text not null default 'voyage-multimodal-3.5',
  created_at timestamptz not null default now(),
  unique (spare_part_id, sort_order)
);

create table if not exists spa_app_settings (
  id int primary key default 1 check (id = 1),
  confidence_threshold double precision not null default 0.78,
  ambiguity_margin double precision not null default 0.06,
  embedding_model text not null default 'voyage-multimodal-3.5',
  updated_at timestamptz not null default now()
);

insert into spa_app_settings (id)
values (1)
on conflict (id) do nothing;

create index if not exists spa_spare_part_images_part_idx
  on spa_spare_part_images (spare_part_id);

alter table spa_spare_parts enable row level security;
alter table spa_spare_part_images enable row level security;
alter table spa_app_settings enable row level security;

create or replace function spa_match_spare_part_images(
  query_embedding text,
  reference_limit int default 3,
  match_count int default 20
)
returns table (
  id uuid,
  spare_part_id uuid,
  similarity double precision,
  sort_order int,
  storage_path text
)
language sql
stable
as $$
  select
    i.id,
    i.spare_part_id,
    (1 - (i.embedding <=> query_embedding::extensions.vector(1024)))::double precision as similarity,
    i.sort_order,
    i.storage_path
  from spa_spare_part_images i
  where i.embedding is not null
    and i.sort_order <= greatest(1, least(coalesce(reference_limit, 3), 3))
  order by i.embedding <=> query_embedding::extensions.vector(1024)
  limit greatest(1, least(coalesce(match_count, 20), 50));
$$;

grant execute on function spa_match_spare_part_images(text, int, int) to service_role;
grant all on table spa_spare_parts to service_role;
grant all on table spa_spare_part_images to service_role;
grant all on table spa_app_settings to service_role;

create table if not exists spa_sales (
  id uuid primary key default gen_random_uuid(),
  bill_no text not null unique,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists spa_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references spa_sales(id) on delete cascade,
  spare_part_id uuid references spa_spare_parts(id) on delete set null,
  name text not null,
  code text not null,
  unit_price numeric(12, 2) not null,
  qty int not null default 1 check (qty > 0),
  line_total numeric(12, 2) not null
);

create index if not exists spa_sales_created_idx on spa_sales (created_at desc);
create index if not exists spa_sale_items_sale_idx on spa_sale_items (sale_id);

alter table spa_sales enable row level security;
alter table spa_sale_items enable row level security;

grant all on table spa_sales to service_role;
grant all on table spa_sale_items to service_role;

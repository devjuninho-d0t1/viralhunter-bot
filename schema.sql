-- B2B Minerador — schema mínimo (Supabase)

create table if not exists folders (
  id bigserial primary key,
  name text unique not null,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists links (
  id bigserial primary key,
  url text not null,
  folder_id bigint references folders(id) on delete cascade,
  added_by text,
  raw_message text,
  sent_to_platform boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_links_folder on links(folder_id);

-- pasta padrão pra links soltos
insert into folders (name) values ('inbox') on conflict (name) do nothing;

-- ============================================================
-- ULEReminders — Supabase schema
-- Run this entire block in the Supabase SQL Editor.
-- ============================================================

-- USERS (company logins)
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  email text,
  password_hash text not null,
  role text default 'member',           -- 'admin' | 'member'
  created_at timestamptz default now()
);

-- INVITES (admin generates one-time signup links)
create table if not exists invites (
  id uuid default gen_random_uuid() primary key,
  token text unique not null,
  created_by uuid references users(id),
  used_at timestamptz,
  used_by uuid references users(id),
  created_at timestamptz default now()
);

-- TILES (a reminder / task card)
create table if not exists tiles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  job text,                              -- job / project name (filterable)
  person text,                           -- primary person (filterable)
  status text default 'open',            -- 'open' | 'in_progress' | 'done'
  due_date text,
  tags text[] default '{}',              -- arbitrary tags
  watchers text[] default '{}',          -- emails notified on every update
  created_by_username text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MESSAGES (threaded back-and-forth on a tile, timestamped)
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  tile_id uuid not null references tiles(id) on delete cascade,
  author_username text,
  body text not null,
  created_at timestamptz default now()
);

-- ATTACHMENTS (documents uploaded to a tile)
create table if not exists attachments (
  id uuid default gen_random_uuid() primary key,
  tile_id uuid not null references tiles(id) on delete cascade,
  file_name text not null,
  file_path text not null,               -- path in storage bucket
  uploaded_by_username text,
  created_at timestamptz default now()
);

-- Row level security: allow all (auth handled client-side via users table)
alter table users        enable row level security;
alter table invites      enable row level security;
alter table tiles        enable row level security;
alter table messages     enable row level security;
alter table attachments  enable row level security;

create policy "all_users"        on users        for all using (true) with check (true);
create policy "all_invites"      on invites      for all using (true) with check (true);
create policy "all_tiles"        on tiles        for all using (true) with check (true);
create policy "all_messages"     on messages     for all using (true) with check (true);
create policy "all_attachments"  on attachments  for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET for documents
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tile-docs', 'tile-docs', true)
on conflict (id) do nothing;

create policy "docs_read"   on storage.objects for select using (bucket_id = 'tile-docs');
create policy "docs_write"  on storage.objects for insert with check (bucket_id = 'tile-docs');
create policy "docs_delete" on storage.objects for delete using (bucket_id = 'tile-docs');

-- ============================================================
-- ADMIN ACCOUNT
-- Default login: admin / admin   (CHANGE THE PASSWORD after first login)
-- Hash below is djb2 of 'admin' + salt 'ule-salt-2024'
-- ============================================================
insert into users (username, email, password_hash, role)
values ('admin', 'admin@yourcompany.com', 'f00c948ef6b998f0', 'admin')
on conflict (username) do nothing;

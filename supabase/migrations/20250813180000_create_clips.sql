-- Simple public clipboard (cl1p-like) feature
-- Stores minimal text content addressable by an ID. Optional read/write gate via a proof token.

create table if not exists public.clips (
  id text primary key,
  content text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  -- If set, clients must present matching proof to read or write
  password_proof text,
  -- Public salt so clients can derive proof from password without revealing the password itself
  password_salt text
);

-- Auto-update updated_at
do $do$
begin
  if not exists (
    select 1 from pg_proc where proname = 'clips_set_updated_at'
  ) then
    create or replace function public.clips_set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end;
    $fn$;
  end if;
end $do$ language plpgsql;

do $do$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_clips_updated_at'
  ) then
    create trigger trg_clips_updated_at
    before update on public.clips
    for each row
    execute function public.clips_set_updated_at();
  end if;
end $do$ language plpgsql;

alter table public.clips enable row level security;

-- Do not allow direct anon table access; interact via secure RPCs below
revoke all on public.clips from anon;
grant select, insert, update, delete on public.clips to authenticated;

-- Fetch a clip if accessible.
-- If the clip has a password_proof set, _proof must match exactly.
create or replace function public.get_clip(_id text, _proof text default null)
returns table (
  id text,
  content text,
  expires_at timestamptz,
  updated_at timestamptz,
  has_password boolean
)
language sql
security definer
as $$
  select c.id, c.content, c.expires_at, c.updated_at, (c.password_proof is not null) as has_password
  from public.clips c
  where c.id = _id
    and (c.expires_at is null or now() <= c.expires_at)
    and (c.password_proof is null or c.password_proof = _proof)
  limit 1;
$$;

-- Lightweight metadata query that never exposes content.
create or replace function public.get_clip_meta(_id text)
returns table (
  clip_exists boolean,
  has_password boolean,
  expires_at timestamptz,
  updated_at timestamptz,
  password_salt text
)
language sql
security definer
as $$
  select
    exists(select 1 from public.clips where id = _id and (expires_at is null or now() <= expires_at)) as clip_exists,
    coalesce((select password_proof is not null from public.clips where id = _id limit 1), false) as has_password,
    (select expires_at from public.clips where id = _id limit 1) as expires_at,
    (select updated_at from public.clips where id = _id limit 1) as updated_at,
    (select password_salt from public.clips where id = _id limit 1) as password_salt;
$$;

-- Create or update a clip. If an existing clip is password-protected, caller must present matching _proof.
-- To set a password on create, pass _set_password_proof. Changing an existing password is allowed only
-- when the correct current _proof is provided. Removing password is not supported by this RPC for simplicity.
create or replace function public.upsert_clip(
  _id text,
  _content text,
  _expires_at timestamptz default null,
  _proof text default null,
  _set_password_proof text default null,
  _set_password_salt text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  existing record;
begin
  select * into existing from public.clips where id = _id limit 1;

  if not found then
    insert into public.clips (id, content, created_by, expires_at, password_proof, password_salt)
    values (_id, _content, (select auth.uid()), _expires_at, _set_password_proof, _set_password_salt);
    return true;
  end if;

  -- Gate updates when password is set
  if existing.password_proof is not null then
    if _proof is null or _proof <> existing.password_proof then
      return false;
    end if;
  end if;

  update public.clips
  set content = _content,
      expires_at = _expires_at,
      password_proof = coalesce(_set_password_proof, existing.password_proof),
      password_salt = coalesce(_set_password_salt, existing.password_salt),
      updated_at = now()
  where id = _id;
  return true;
end;
$$;

grant execute on function public.get_clip(text, text) to anon, authenticated;
grant execute on function public.get_clip_meta(text) to anon, authenticated;
grant execute on function public.upsert_clip(text, text, timestamptz, text, text, text) to anon, authenticated;



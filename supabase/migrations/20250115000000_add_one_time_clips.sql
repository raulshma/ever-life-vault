-- Add one-time view functionality to clips
-- This allows clips to be viewed only once before being automatically deleted

-- Add new columns for one-time viewing
alter table if exists public.clips 
add column if not exists one_time_view boolean default false,
add column if not exists view_count integer default 0;

-- Create function to get a clip with one-time view handling
create or replace function public.get_clip_one_time(_id text, _proof text default null)
returns table (
  id text,
  content text,
  expires_at timestamptz,
  updated_at timestamptz,
  has_password boolean,
  one_time_view boolean,
  view_count integer
)
language sql
security definer
as $$
  with clip_data as (
    select c.*
    from public.clips c
    where c.id = _id
      and (c.expires_at is null or now() <= c.expires_at)
      and (c.password_proof is null or c.password_proof = _proof)
    limit 1
  ),
  updated_clip as (
    update public.clips 
    set view_count = view_count + 1
    where id = _id 
      and one_time_view = true 
      and view_count = 0
  ),
  deleted_clip as (
    delete from public.clips 
    where id = _id 
      and one_time_view = true 
      and view_count > 0
  )
  select 
    c.id,
    c.content,
    c.expires_at,
    c.updated_at,
    (c.password_proof is not null) as has_password,
    c.one_time_view,
    c.view_count
  from clip_data c;
$$;

-- Update the existing get_clip function to handle one-time views
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
    and (not c.one_time_view or c.view_count = 0)
  limit 1;
$$;

-- Update the upsert_clip function to support one-time view setting
create or replace function public.upsert_clip(
  _id text,
  _content text,
  _expires_at timestamptz default null,
  _proof text default null,
  _set_password_proof text default null,
  _set_password_salt text default null,
  _one_time_view boolean default false
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
    insert into public.clips (id, content, created_by, expires_at, password_proof, password_salt, one_time_view)
    values (_id, _content, (select auth.uid()), _expires_at, _set_password_proof, _set_password_salt, _one_time_view);
    return true;
  end if;

  -- Gate updates when password is set
  if existing.password_proof is not null then
    if _proof is null or _proof <> existing.password_proof then
      return false;
    end if;
  end if;

  -- Don't allow changing one_time_view after creation
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

-- Grant execute permissions on the new function
grant execute on function public.get_clip_one_time(text, text) to anon, authenticated;

-- Update existing function permissions
revoke execute on function public.upsert_clip(text, text, timestamptz, text, text, text) from anon, authenticated;
grant execute on function public.upsert_clip(text, text, timestamptz, text, text, text, boolean) to anon, authenticated;

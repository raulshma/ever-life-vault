-- Fix the get_clip_one_time function to resolve ambiguous column reference
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

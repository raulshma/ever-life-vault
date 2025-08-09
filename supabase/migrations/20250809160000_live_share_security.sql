-- Live Share security enhancements: password proof and verification RPC

alter table if exists public.live_share_rooms
  add column if not exists password_salt text,
  add column if not exists password_proof text,
  add column if not exists expires_at timestamptz,
  add column if not exists locked boolean not null default false;

CREATE INDEX idx_live_share_rooms_created_by 
ON public.live_share_rooms (created_by);

-- Simple RPC to verify proof. This is a stub; in future it can issue a join_token.
create or replace function public.verify_live_share_access(_id text, _proof text)
returns boolean
language sql
security definer
as $$
  select coalesce((select (password_proof is not null and password_proof = _proof)
                   from public.live_share_rooms
                   where id = _id), false);
$$;

grant execute on function public.verify_live_share_access(text, text) to anon, authenticated;



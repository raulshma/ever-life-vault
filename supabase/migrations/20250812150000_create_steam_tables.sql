-- Steam integration tables and policies

create table if not exists public.steam_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steamid64 text not null unique,
  unique (user_id),
  persona_name text,
  avatar_url text,
  profile_visibility text,
  country text,
  steam_level int,
  linked_at timestamptz not null default now(),
  synced_at timestamptz
);
create index if not exists steam_accounts_user_id_idx on public.steam_accounts(user_id);

create table if not exists public.steam_games (
  appid int primary key,
  name text,
  header_image text,
  genres jsonb,
  metascore int,
  is_free boolean,
  updated_at timestamptz not null default now()
);

create table if not exists public.steam_ownership (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null references public.steam_games(appid) on delete cascade,
  playtime_forever_minutes int not null default 0,
  playtime_2weeks_minutes int not null default 0,
  last_played_at timestamptz,
  primary key (user_id, appid)
);
create index if not exists steam_ownership_user_id_idx on public.steam_ownership(user_id);
create index if not exists steam_ownership_last_played_idx on public.steam_ownership(last_played_at);

create table if not exists public.steam_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null,
  apiname text not null,
  achieved boolean not null,
  unlocktime timestamptz,
  primary key (user_id, appid, apiname)
);
create index if not exists steam_achievements_user_id_idx on public.steam_achievements(user_id);

create table if not exists public.steam_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null,
  stat_name text not null,
  stat_value double precision not null,
  primary key (user_id, appid, stat_name)
);

alter table public.steam_accounts enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'steam_accounts'
          and policyname = 'steam_accounts_own'
    ) then
        execute 'create policy steam_accounts_own on public.steam_accounts for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.steam_ownership enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'steam_ownership'
          and policyname = 'steam_ownership_own'
    ) then
        execute 'create policy steam_ownership_own on public.steam_ownership for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.steam_achievements enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'steam_achievements'
          and policyname = 'steam_achievements_own'
    ) then
        execute 'create policy steam_achievements_own on public.steam_achievements for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;

alter table public.steam_game_stats enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'steam_game_stats'
          and policyname = 'steam_game_stats_own'
    ) then
        execute 'create policy steam_game_stats_own on public.steam_game_stats for all using (user_id = (SELECT auth.uid()))';
    end if;
end
$$ language plpgsql;



-- Harden catalog tables RLS: restrict reads to authenticated users; writes via service role only

-- steam_games: enable RLS and allow SELECT for authenticated users only
alter table if exists public.steam_games enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'steam_games'
          and policyname = 'steam_games_select_authenticated'
    ) then
        execute 'create policy steam_games_select_authenticated on public.steam_games for select using ((select auth.uid()) is not null)';
    end if;
end
$$ language plpgsql;

-- mal_anime: enable RLS and allow SELECT for authenticated users only
alter table if exists public.mal_anime enable row level security;
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'mal_anime'
          and policyname = 'mal_anime_select_authenticated'
    ) then
        execute 'create policy mal_anime_select_authenticated on public.mal_anime for select using ((select auth.uid()) is not null)';
    end if;
end
$$ language plpgsql;



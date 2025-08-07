-- Add custom_data JSONB to store per-day custom values on monthly_status_sheets
-- Values are stored per row (per day) as a flat key-value object of custom column ids to values
-- Example: {"col_hours":"8","col_mode":"WFH"}
alter table if exists public.monthly_status_sheets
  add column if not exists custom_data jsonb not null default '{}'::jsonb;

-- Ensure custom_data remains an object
create or replace function public.enforce_custom_data_object()
returns trigger
language plpgsql
as $$
begin
  if jsonb_typeof(new.custom_data) is distinct from 'object' then
    new.custom_data := '{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_custom_data_object on public.monthly_status_sheets;
create trigger trg_enforce_custom_data_object
before insert or update on public.monthly_status_sheets
for each row
execute function public.enforce_custom_data_object();
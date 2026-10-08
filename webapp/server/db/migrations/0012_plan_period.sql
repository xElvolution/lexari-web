-- Yearly plans: a plan purchase records its billing period. Additive only: one column with a default, so every
-- existing purchase reads as monthly (what it was). A yearly purchase runs one calendar year and refills its usage
-- pools every month; the server works out the monthly cycle from starts_at.
alter table plan_purchases add column if not exists period text not null default 'monthly';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plan_purchases_period_check') then
    alter table plan_purchases add constraint plan_purchases_period_check check (period in ('monthly', 'yearly'));
  end if;
end $$;

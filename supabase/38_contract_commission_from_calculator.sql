begin;

alter table public.contracts
  add column if not exists boiler_capacity text not null default 'none'
    check (boiler_capacity in ('none','80','150')),
  add column if not exists ems boolean not null default false,
  add column if not exists cable_length_meters numeric(8,2) not null default 8,
  add column if not exists pricing_adjustment_net numeric(12,2) not null default 0,
  add column if not exists commission_sale_net numeric(12,2),
  add column if not exists commission_base_net numeric(12,2),
  add column if not exists commission_calc_error text,
  add column if not exists commission_calculated_at timestamptz;

-- The previous version calculated commission from a fixed salesperson margin.
-- Commission is now derived from the actual contract sale price and calculator base price.
drop trigger if exists a_snapshot_contract_commission on public.contracts;
drop function if exists public.snapshot_contract_commission();

commit;
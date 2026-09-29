begin;

alter table public.contracts
  add column if not exists commission_company_margin_net numeric(12,2);

with recovered_ems as (
  update public.contracts
  set ems = true
  where crm_environment = 'production'
    and coalesce(ems, false) = false
    and coalesce(additional_notes, '') ~* '(^|[^[:alpha:]])ems([^[:alpha:]]|$)'
  returning id
),
source as (
  select
    c.id,
    coalesce(p.company_margin_net, 0) as company_margin_net,
    c.commission_sale_net as sale_net,
    c.commission_base_net as old_base_net,
    c.commission_percent as pct,
    exists(select 1 from recovered_ems r where r.id = c.id) as recovered_ems
  from public.contracts c
  left join public.profiles p on p.id = c.created_by
  where c.crm_environment = 'production'
),
calculated as (
  select
    *,
    case
      when old_base_net is null then null
      else round(old_base_net + company_margin_net + case when recovered_ems then 3000 else 0 end, 2)
    end as new_base_net
  from source
)
update public.contracts c
set
  commission_company_margin_net = x.company_margin_net,
  commission_base_net = x.new_base_net,
  commission_margin_net = case
    when x.new_base_net is null then 0
    else round(coalesce(x.sale_net, 0) - x.new_base_net, 2)
  end,
  commission_amount = case
    when x.new_base_net is null then 0
    else round(greatest(coalesce(x.sale_net, 0) - x.new_base_net, 0) * coalesce(x.pct, 0) / 100, 2)
  end,
  commission_calculated_at = now()
from calculated x
where c.id = x.id;

commit;
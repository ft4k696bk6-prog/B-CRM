begin;

-- A resignation remains assigned to the person who handled it. This keeps the
-- audit/settlement owner and does not require sales roles to change assignment.
update public.leads l
set assigned_to = (
  select h.user_id from public.lead_history h
  where h.lead_id = l.id and h.user_id is not null
  order by h.created_at desc limit 1
)
where l.status = 'Rezygnacja' and l.assigned_to is null
  and exists (select 1 from public.lead_history h where h.lead_id = l.id and h.user_id is not null);

alter table public.contracts add column if not exists commission_margin_net numeric(12,2) not null default 0;
alter table public.contracts add column if not exists commission_percent numeric(6,3) not null default 0
  check (commission_percent >= 0 and commission_percent <= 100);
alter table public.contracts add column if not exists commission_amount numeric(12,2) not null default 0;

-- Snapshot existing payouts once; later setting changes must not rewrite them.
update public.contracts c
set commission_margin_net = coalesce(p.sales_margin_net, 0),
    commission_percent = coalesce(p.commission_percent, 0),
    commission_amount = round(coalesce(p.sales_margin_net, 0) * coalesce(p.commission_percent, 0) / 100, 2)
from public.profiles p
where p.id = c.created_by
  and c.commission_margin_net = 0 and c.commission_percent = 0 and c.commission_amount = 0;

commit;

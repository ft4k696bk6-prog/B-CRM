alter table public.contracts
  add column if not exists inverter_phase text;

alter table public.contracts
  drop constraint if exists contracts_inverter_phase_check;

alter table public.contracts
  add constraint contracts_inverter_phase_check
  check (inverter_phase is null or inverter_phase in ('1F', '3F'));

comment on column public.contracts.inverter_phase is
  'Liczba faz falownika: 1F albo 3F; null gdy umowa nie obejmuje falownika.';

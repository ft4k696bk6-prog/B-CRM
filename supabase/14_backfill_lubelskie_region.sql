-- Uzupełnia województwo w starszych leadach, które miały wyłącznie kod pocztowy.
-- Nie nadpisuje ręcznie ustawionego województwa.
update public.leads
set voivodeship = 'lubelskie'
where (voivodeship is null or trim(voivodeship) = '')
  and postal_code similar to '(20|21|22|23|24)-%';

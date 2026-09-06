# Audyt danych produkcyjnych — 2026-09-06

## Umowy

Przed usunięciem runtime fallbacku po nazwiskach sprawdzono produkcyjną bazę:

- leady ze statusem `Umowa`: 14,
- rekordy `contracts`: 15,
- leady `Umowa` bez rekordu `contracts`: 0,
- rekordy `contracts` bez odpowiadającego leada: 0.

Wniosek: lista zdrowej produkcji nie potrzebuje syntetyzowania umów po imieniu/nazwisku klienta. `lead_history` pozostaje wyłącznie kontrolowaną ścieżką zgodności dla starych instalacji / awarii migracji.

## Telefony

Przed normalizacją: 2233 leady. Po bezpiecznym backfillu:

- 2232 numery w kanonicznym E.164,
- 2224 polskie numery `+48XXXXXXXXX`,
- 1 niejednoznaczny historyczny numer pozostawiony do ręcznej weryfikacji zamiast zgadywania,
- 2 historyczne grupy duplikatów telefonu (4 rekordy) pozostawiono bez automatycznego scalania, ponieważ mogą mieć odrębną historię CRM.

Nowe inserty i zmiany telefonu są chronione triggerem E.164.

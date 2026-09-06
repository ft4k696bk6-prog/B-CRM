# Tymczasowo wyłączone workspace'y

Na decyzję produktową 2026-09-06 wyłączone są bez kasowania danych:

- `/accounting`,
- `/logistics`,
- `/installation`.

Trasy przekierowują do `/realizacja/umowy`. Historyczne tabele, rekordy i pliki pozostają nienaruszone.

`/panel` pozostaje aktywny, bo czyta rzeczywiste umowy z API. `/equipment` i `/finance` wymagają osobnej decyzji przed traktowaniem ich jako źródła prawdy, ponieważ ich starszy workspace używa lokalnego stanu przeglądarki.

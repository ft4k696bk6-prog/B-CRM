# Routing nowych leadów

Automatyczny routing działa w bazie przed insertem leada.

Warunki:

- działa tylko gdy `assigned_to` jest puste,
- wymaga pasującego województwa i aktywnej reguły,
- brak reguły pozostawia leada w puli,
- kilka osób jest rozdzielanych wg udziałów sumujących się do 100%,
- stan kolejki routingu jest liczony osobno dla środowiska CRM i województwa,
- advisory lock chroni przed nierównym rozdziałem przy równoczesnym imporcie.

Panel `/admin/control` zarządza regułami przez serwerowe API. Tabele routingu nie są udostępnione bezpośrednio klientowi przez RLS.

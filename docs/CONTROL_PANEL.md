# Panel Kontrola

Panel `/admin/control` jest dostępny wyłącznie dla roli owner/admin.

## Blokady CRM

Przycisk odblokowania nie usuwa call-backów ani spotkań. Ustawia `profiles.mandatory_queue_snoozed_until` na 24 godziny. Po upływie czasu obowiązkowa kolejka działa ponownie. Administrator może przywrócić ją wcześniej.

## Routing województw

Reguły są przechowywane w `lead_routing_rules`. Trigger `assign_lead_by_voivodeship` działa przed insertem nowego leada tylko wtedy, gdy `assigned_to` jest puste.

- brak reguły: lead pozostaje nieprzypisany,
- jedna osoba: 100%,
- kilka osób: udziały muszą sumować się do 100%,
- przy równoległych insertach routing jest serializowany per środowisko + województwo,
- ręczny lead utworzony przez handlowca zachowuje handlowca jako właściciela.

## Telefony

Kanoniczny format w `leads.phone` to E.164, np. `+48600123456`. UI może prezentować numer z odstępami. Polski numer 9-cyfrowy jest bezpiecznie interpretowany jako +48; dla innych lokalnych formatów CRM wymaga jawnego kodu kraju.

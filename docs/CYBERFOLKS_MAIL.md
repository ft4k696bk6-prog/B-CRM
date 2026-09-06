# cyber_Folks mail integration

Planowana integracja CRM nie zależy od hostowania aplikacji u tego samego dostawcy.

Preferowany model:

- SMTP po stronie serwera do wysyłki ofert,
- IMAP po stronie serwera do synchronizacji skrzynki / wątków,
- hasła i dane dostępowe wyłącznie jako sekrety środowiskowe,
- wiadomości powiązane z leadem po adresie e-mail / identyfikatorze wiadomości,
- wysyłka i statusy zapisywane w historii CRM.

Nie umieszczać danych SMTP/IMAP w kodzie klienta.

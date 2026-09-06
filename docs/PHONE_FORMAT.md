# Format numerów telefonu

B-CRM przechowuje `leads.phone` w E.164 bez spacji, np. `+48600123456`.

UI może pokazać polski numer jako `+48 600 123 456`.

Dozwolone wejście:

- `600123456` -> `+48600123456`,
- `48 600 123 456` -> `+48600123456`,
- `+48 600 123 456` -> `+48600123456`,
- `0049...` -> `+49...`,
- zagraniczne: wymagany jawny kod kraju.

CRM nie zgaduje kraju dla niejednoznacznych lokalnych numerów.

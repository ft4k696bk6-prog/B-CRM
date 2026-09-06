# Admin Control API

`GET/PATCH /api/admin/control` wymaga uwierzytelnionego profilu owner/admin i zawsze ogranicza dane do jego `crm_environment`.

Akcje PATCH:

- `unlock_queue` — czasowo odblokowuje obowiązkową kolejkę (domyślnie 24 h),
- `restore_queue` — przywraca obowiązkową kolejkę natychmiast,
- `save_routing` — atomowo zastępuje reguły procentowego routingu wybranego województwa.

Zmiany są logowane do `audit_events`.

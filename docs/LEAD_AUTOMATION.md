# Automatyczny import leadów

## Facebook Lead Ads

Webhook CRM:

```text
https://b-crm-berni.vercel.app/api/integrations/meta/leads
```

Wymagane zmienne w Vercel:

```text
META_LEAD_ADS_VERIFY_TOKEN=
META_PAGE_ACCESS_TOKEN=
META_LEAD_ADS_ACCESS_TOKEN=
META_GRAPH_VERSION=v20.0
META_APP_SECRET=
```

Nowe leady z formularza Meta trafiają do puli leadów jako `Nowy`. Duplikaty są pomijane po znormalizowanym telefonie albo e-mailu.

## Google Drive

Cron Vercel odpala raz dziennie:

```text
/api/integrations/google-drive/leads
```

Obsługiwane pliki: Google Sheets, `.xlsx`, `.csv`.

Wymagane zmienne w Vercel:

```text
CRON_SECRET=
GOOGLE_DRIVE_SYNC_SECRET=
GOOGLE_DRIVE_LEAD_SYNC_ENABLED=true
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_LEAD_FILE_IDS=
GOOGLE_DRIVE_LEAD_FOLDER_ID=
```

Najprostsza konfiguracja:

1. Utwórz konto serwisowe Google z dostępem tylko do odczytu.
2. Udostępnij konto serwisowe plikowi albo folderowi z leadami.
3. Wpisz JSON konta serwisowego w `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`.
4. Wpisz ID plików w `GOOGLE_DRIVE_LEAD_FILE_IDS` albo ID folderu w `GOOGLE_DRIVE_LEAD_FOLDER_ID`.
5. Ustaw `GOOGLE_DRIVE_LEAD_SYNC_ENABLED=true`.

Ręczne sprawdzenie bez zapisu:

```text
https://b-crm-berni.vercel.app/api/integrations/google-drive/leads?dryRun=true&secret=...
```

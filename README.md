# UxMail

UxMail ar en modern e-postklient med flera konton, forhamtning, automatisk sync och SPA-flode.

## Snabbstart

1. Klona repot:
```bash
git clone https://github.com/Swephoenix/Uxmail.git
cd Uxmail
```

2. Starta allt med ett kommando:
```bash
./start_uxmail.sh
```

`start_uxmail.sh` gor foljande:
- Skapar `.env` fran `.env.example` om den saknas
- Genererar nycklar och hemligheter
- Startar PostgreSQL (kraver sudo) och skapar roll/databas
- Nollstaller databasen (standardbeteende)
- Startar appen och bakgrunds-sync

Appen finns pa http://localhost:3000

## Viktigt om reset

Som standard rensar `start_uxmail.sh` databasen och hemligheter varje start.
Om du vill behalla data, satt i `.env`:
```
UXMAIL_RESET=0
```

## Forutsattningar

- Node.js 18+
- npm
- PostgreSQL (lokal eller managed)

## Konfiguration (.env)

Vanliga nycklar:
- `DATABASE_URL` (t.ex. `postgresql://uxmail:uxmailpassword@localhost:5432/uxmail_db?schema=public`)
- `ENCRYPTION_KEY` (skapad automatiskt om tom)
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME`

Beteende:
- `UXMAIL_RESET=1|0` (standard: 1)
- `UXMAIL_START_POSTGRES=1|0` (standard: 1)
- `UXMAIL_SETUP_DB=1|0` (standard: 1)
- `ADMIN_AUTO_LOGIN=1|0` (auto-login bara for admin-dashboarden via `/api/auth/me?admin=1`)

## Nextcloud

Uxmail kan kopplas till Nextcloud via OAuth2 for att lista filer, bifoga dem eller skapa delningslankar direkt fran compose-fonstret.

Krav:
- Nextcloud OAuth2 app aktiverad
- `NC_BASE_URL`, `NC_PUBLIC_URL`, `NC_OAUTH_DATA_PATH` och `UXMAIL_PUBLIC_URL` satta i `.env`

Se `NEXTCLOUD.md` for fulla detaljer om flodet och endpoints.

## Admin

- Admin-UI finns pa `/admin` och anvander `Uxmail_admin/Uxmail_admin.html`.
- Admin auto-login sker endast for admin-dashboarden (inte mail-klienten).
- Dashboarden visar gron/rod statuslampa per mejlkonto baserat pa IMAP-test.
- Om losenord saknas visas varning.

## E-post och forslag

- Adresser fran skickade och mottagna mejl sparas som kontakter.
- Dessa visas som forslag i `To`-faltet nar du skriver.

## Utveckling

Projektet ar byggt med:
- Next.js
- React
- TypeScript
- Prisma (PostgreSQL)
- Tailwind CSS
- Lucide React
- Tiptap

## Deployment

```bash
npm run build
npm start
```

## Felsokning

- Om Postgres inte startar automatiskt: starta manuellt (t.ex. `sudo systemctl start postgresql`).
- Om DB saknas: kör `./scripts/setup_postgres_local.sh`.
- Om du vill stanga av reset: satt `UXMAIL_RESET=0` i `.env`.

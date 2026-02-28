# Ambmail

Ambmail ar en modern e-postklient med flera konton, forhamtning, automatisk sync och SPA-flode.

## Snabbstart

1. Klona repot:
```bash
git clone https://github.com/Swephoenix/Uxmail.git
cd Uxmail
```

2. Starta allt med ett kommando:
```bash
./start_ambmail.sh
```

`start_ambmail.sh` gor foljande:
- Skapar `.env` fran `.env.example` om den saknas
- Genererar nycklar och hemligheter
- Startar PostgreSQL (kraver sudo) och skapar roll/databas
- Nollstaller databasen (standardbeteende)
- Startar appen och bakgrunds-sync

Appen finns pa http://localhost:3000

## Viktigt om reset

Som standard rensar `start_ambmail.sh` databasen och hemligheter varje start.
Om du vill behalla data, satt i `.env`:
```
AMBMAIL_RESET=0
```

## Forutsattningar

- Node.js 18+
- npm
- PostgreSQL (lokal eller managed)

## Konfiguration (.env)

Vanliga nycklar:
- `DATABASE_URL` (t.ex. `postgresql://ambmail:ambmailpassword@localhost:5432/ambmail_db?schema=public`)
- `ENCRYPTION_KEY` (skapad automatiskt om tom)
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`
- `ADMIN_PANEL_SECRET` (losenord till adminpanelen)
- `ADMIN_PANEL_PATH` (url-path till adminpanelen, t.ex. `ostmedsmorochskinka999`)

Beteende:
- `AMBMAIL_RESET=1|0` (standard: 1)
- `AMBMAIL_START_POSTGRES=1|0` (standard: 1)
- `AMBMAIL_SETUP_DB=1|0` (standard: 0)

## Nextcloud

Uxmail kan kopplas till Nextcloud via OAuth2 for att lista filer, bifoga dem eller skapa delningslankar direkt fran compose-fonstret.

Krav:
- Nextcloud OAuth2 app aktiverad
- `NC_BASE_URL`, `NC_PUBLIC_URL`, `NC_OAUTH_DATA_PATH` och `AMBMAIL_PUBLIC_URL` satta i `.env`

Se `Nextclouddemo/NEXTCLOUD.md` for fulla detaljer om flodet och endpoints.
For lokal Nextcloud-demo, kör `./Nextclouddemo/start_nextcloud.sh`.
Se även `NEXTCLOUD_AUTENTISERING_OCH_FILATKOMST.md` for en steg-for-steg-beskrivning av hur autentisering, WebDAV och Share API fungerar i Ambmail.

## Inloggning

- Inloggning sker med e-postadress + losenord.
- Vid forsta inloggningen skapas en lokal anvandarprofil automatiskt i databasen.
- Varje anvandare hanterar sina egna konton i klienten.

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

## Kor med Docker

1. Skapa en lokal `.env` om du inte redan har en:
```bash
cp .env.example .env
```

2. Starta app + worker + PostgreSQL:
```bash
docker compose up --build -d
```

3. Oppna appen:
```text
http://localhost:3000
```

4. Se loggar:
```bash
docker compose logs -f app worker db
```

5. Stoppa allt:
```bash
docker compose down
```

## Felsokning

- Om Postgres inte startar automatiskt: starta manuellt (t.ex. `sudo systemctl start postgresql`).
- Om DB saknas: kör `./scripts/setup_postgres_local.sh`.
- Om du vill stanga av reset: satt `AMBMAIL_RESET=0` i `.env`.

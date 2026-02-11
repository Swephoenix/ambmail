# Nextcloud‑anslutning i Uxmail

Det här dokumentet beskriver hur Uxmail kopplar mot Nextcloud, hur OAuth‑flödet fungerar och hur filer listas/länkas/bifogas i compose‑fönstret.

## Översikt

Uxmail använder Nextcloud OAuth2 för att autentisera den användare som redan är inloggad i Nextcloud. När användaren kopplar sitt konto lagras tokens i databasen och används därefter för att:

- lista användarens filer via WebDAV
- hämta filer som bilagor
- skapa delningslänkar (share links) som kan klistras in i mejlet

All åtkomst sker alltid mot den Nextcloud‑användare som faktiskt är inloggad i Nextcloud under OAuth‑flödet.

## Miljövariabler

Sätt följande i `Uxmail/.env` (se även `Uxmail/.env.example`):

- `NC_BASE_URL` – Intern URL mot Nextcloud (t.ex. `http://localhost:8080`)
- `NC_PUBLIC_URL` – Publik URL mot Nextcloud (används för authorize‑redirect)
- `NC_OAUTH_DATA_PATH` – Sökväg till Nextclouds `oauth2-client.txt`
- `UXMAIL_PUBLIC_URL` – Publik URL till Uxmail (används för OAuth callback)

I Docker‑setupen i detta repo skapas `oauth2-client.txt` av `nc-init.sh` och ligger i volymen `nextcloud`.

## OAuth‑flöde

1. I compose‑fönstret klickar användaren på **Nextcloud**.
2. Om ingen token finns visas knappen **Anslut Nextcloud**.
3. Knappen går till `/api/nextcloud/auth/start` som:
   - skapar en `state`
   - sparar `state` i `uxmail_nc_state` cookie
   - redirectar till Nextclouds `/apps/oauth2/authorize`
4. Nextcloud returnerar till `/api/nextcloud/auth/callback`.
5. Callback:
   - validerar `state`
   - byter `code` mot `access_token` + ev. `refresh_token`
   - slår upp aktuell Nextcloud‑användare via OCS (`/ocs/v2.php/cloud/user`)
   - sparar token + `ncUserId` i tabellen `NextcloudToken`

Efter detta har Uxmail en token kopplad till den inloggade användaren och kan läsa just den användarens filer.

## API‑endpoints

- `GET /api/nextcloud/status`
  - Returnerar om Nextcloud är kopplat för aktuell Uxmail‑användare.

- `GET /api/nextcloud/files?path=...`
  - Listar filer/mappar via WebDAV (`PROPFIND`)
  - Kräver giltig token och `ncUserId`

- `POST /api/nextcloud/download`
  - Hämtar fil via WebDAV
  - Sparar den i `/tmp/uxmail-uploads` och returnerar en token
  - Compose använder token som vanlig bilaga

- `POST /api/nextcloud/share`
  - Skapar en share‑link via OCS‑API
  - Returnerar URL som klistras in i mejlet

## Compose‑fönstret

I `ComposeEmail` finns en ny knapp **Nextcloud**. När modal öppnas:

- `/api/nextcloud/status` kontrollerar anslutning
- `/api/nextcloud/files` listar filer
- användaren kan:
  - **Bifoga** → hämtar filen och lägger den som bilaga
  - **Skapa länk** → skapar delningslänk och infogar i mejlet

## Databas

Tokens lagras i tabellen `NextcloudToken` (Prisma):

- `userId` (unique)
- `accessToken`
- `refreshToken` (om tillgänglig)
- `expiresAt`
- `ncUserId`

`getValidToken` i `src/lib/nextcloud.ts` ansvarar för refresh och att `ncUserId` alltid finns innan filer listas.

## Säkerhet

- OAuth‑state skyddar mot CSRF.
- Access sker alltid på den Nextcloud‑användare som faktiskt loggat in via OAuth.
- Tokens är server‑side och exponeras inte i klienten.

## Felsökning

- Kontrollera att Nextcloud OAuth2‑appen är aktiverad.
- Kontrollera att `NC_OAUTH_DATA_PATH` pekar på rätt fil.
- Om du kör bakom proxy: sätt korrekt `NC_PUBLIC_URL` + `UXMAIL_PUBLIC_URL`.

# Anslut Uxmail till befintlig Nextcloud (Docker)

Den här guiden visar hur du kopplar Uxmail till en Nextcloud-instans som redan körs i Docker.

## 1. Kontrollera att Nextcloud körs och hitta porten

Kör:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i nextcloud
```

Exempelutdata:

```text
nextclouddemo-nextcloud-1   0.0.0.0:8084->80/tcp
```

I exemplet är Nextcloud-URL: `http://localhost:8084`.

## 2. Logga in i Nextcloud som admin

Öppna Nextcloud i webbläsaren, t.ex.:

`http://localhost:8084`

Logga in med admin-kontot.

## 3. Skapa OAuth2-klient i Nextcloud

I Nextcloud admininställningar:

1. Gå till OAuth2-klienter (Security/OAuth2).
2. Skapa en ny klient.
3. Sätt redirect URI till:
`http://localhost:3000/api/nextcloud/auth/callback`
4. Spara och kopiera:
- `Client ID`
- `Client Secret`

## 4. Uppdatera Uxmail `.env`

Öppna `.env` i Uxmail och sätt:

```env
NC_BASE_URL="http://localhost:8084"
NC_PUBLIC_URL="http://localhost:8084"
AMBMAIL_PUBLIC_URL="http://localhost:3000"

NC_OAUTH_CLIENT_ID="DIN_CLIENT_ID"
NC_OAUTH_CLIENT_SECRET="DIN_CLIENT_SECRET"
```

Notera:
- Byt `8084` till den port du fick i steg 1.
- När `NC_OAUTH_CLIENT_ID` och `NC_OAUTH_CLIENT_SECRET` är satta behövs normalt inte `NC_OAUTH_DATA_PATH`.

## 5. Starta om Uxmail

Om Uxmail redan kör:

1. Stoppa processen.
2. Starta igen med:

```bash
./start_ambmail.sh
```

## 6. Koppla kontot i Uxmail

1. Öppna Uxmail (`http://localhost:3000`).
2. Gå till compose-fönstret.
3. Klicka **Nextcloud** -> **Anslut Nextcloud**.
4. Godkänn i Nextcloud.

När callback lyckas är kontot kopplat.

## 7. Verifiera att anslutningen fungerar

I compose-modalen för Nextcloud ska du kunna:
- lista filer
- bifoga filer
- skapa delningslänkar

## Felsökning

- `Missing Nextcloud OAuth client credentials`:
  kontrollera att `NC_OAUTH_CLIENT_ID` och `NC_OAUTH_CLIENT_SECRET` finns i `.env`.
- OAuth redirect/state-fel:
  kontrollera exakt redirect URI i både Nextcloud-klienten och Uxmail:
  `http://localhost:3000/api/nextcloud/auth/callback`
- Fel Nextcloud-host/port:
  kontrollera `NC_BASE_URL` och `NC_PUBLIC_URL`.
- Kontrollera att OAuth2-appen är aktiv i Nextcloud:

```bash
docker exec -u 33 nextclouddemo-nextcloud-1 php /var/www/html/occ app:list | grep oauth2
```


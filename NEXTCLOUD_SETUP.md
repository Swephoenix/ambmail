# Anslut Ambmail till Nextcloud

Den här guiden visar hur du konfigurerar Ambmail för att använda Nextcloud OAuth2 för filåtkomst, bilagor och delningslänkar.

## Översikt

När Nextcloud är anslutet kan du i Ambmail:
- ✅ Bifoga filer från Nextcloud i mejl
- ✅ Skapa och infoga delningslänkar till Nextcloud-filer
- ✅ Navigera och bläddra i dina Nextcloud-filer direkt i compose-vyn

## Steg 1: Kontrollera din Nextcloud-instans

### För Nextcloud i Docker

Kör för att hitta port och nätverk:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i nextcloud
docker network ls | grep nextcloud
```

Exempelutdata:
```
nextcloud   0.0.0.0:8084->80/tcp
nextcloud-net
```

### Viktiga uppgifter att notera
- **Nextcloud URL (intern):** `http://nextcloud:80` (från andra containrar)
- **Nextcloud URL (extern):** `https://din-nextcloud-url.se` (från browser)
- **Ambmail URL:** `http://localhost:3000` eller `https://ambmail.din-domän.se`

## Steg 2: Skapa OAuth2-applikationer i Nextcloud

Du behöver **två OAuth2-applikationer** om du vill kunna använda både localhost och extern åtkomst.

### 2.1 Extern OAuth2-applikation (för produktionsmiljö)

1. Logga in i Nextcloud som admin
2. Gå till **Administration → Security → OAuth2**
3. Klicka **"Add client"**
4. Fyll i:
   - **Name:** `Ambmail (external)`
   - **Redirect URI:** `https://ambmail.din-domän.se/api/nextcloud/auth/callback`
5. Spara och kopiera:
   - **Client Identifier** (spara som `NC_OAUTH_CLIENT_ID`)
   - **Client Secret** (spara som `NC_OAUTH_CLIENT_SECRET`)

### 2.2 Lokal OAuth2-applikation (för utveckling)

1. Skapa ytterligare en klient på samma sätt
2. Fyll i:
   - **Name:** `Ambmail (localhost)`
   - **Redirect URI:** `http://localhost:3000/api/nextcloud/auth/callback`
3. Spara och kopiera:
   - **Client Identifier** (spara som `NC_OAUTH_CLIENT_ID_LOCAL`)
   - **Client Secret** (spara som `NC_OAUTH_CLIENT_SECRET_LOCAL`)

## Steg 3: Uppdatera Ambmail .env

Redigera `.env` i Ambmail-projektet:

```bash
# Nextcloud bas-URL (intern åtkomst från containrar)
# Använd containernamn om Nextcloud körs i Docker på samma maskin
NC_BASE_URL="http://nextcloud:80"

# Nextcloud offentlig URL (som användare ser)
NC_PUBLIC_URL="https://din-nextcloud-url.se"

# Ambmails publika URL
AMBMAIL_PUBLIC_URL="https://ambmail.din-domän.se"

# OAuth2-klient för extern åtkomst (primär)
NC_OAUTH_CLIENT_ID="din-externa-client-id"
NC_OAUTH_CLIENT_SECRET="din-externa-client-secret"

# OAuth2-klient för localhost (fallback)
NC_OAUTH_CLIENT_ID_LOCAL="din-lokala-client-id"
NC_OAUTH_CLIENT_SECRET_LOCAL="din-lokala-client-secret"

# TLS för självsignerade certifikat (endast utveckling)
NODE_TLS_REJECT_UNAUTHORIZED="0"
```

### Viktiga noteringar

| Variabel | Beskrivning | Exempel |
|----------|-------------|---------|
| `NC_BASE_URL` | Intern URL som Ambmail-containrar använder | `http://nextcloud:80` |
| `NC_PUBLIC_URL` | Extern URL som användare når Nextcloud på | `https://nextcloud.se` |
| `AMBMAIL_PUBLIC_URL` | URL där Ambmail nås | `https://ambmail.se` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Sätt till `"0"` för självsignerade certifikat | `"0"` |

## Steg 4: Nätverkskonfiguration (Docker)

Om Nextcloud och Ambmail körs i separata Docker-nätverk:

```bash
# Anslut Ambmail-containrar till Nextclouds nätverk
docker network connect nextcloud-net ambmail-app
docker network connect nextcloud-net ambmail-worker
```

Alternativt, lägg till i `docker-compose.yml`:

```yaml
services:
  app:
    external_links:
      - nextcloud
    networks:
      - ambmail_net
      - nextcloud-net

networks:
  nextcloud-net:
    external: true
```

## Steg 5: Starta om Ambmail

```bash
# Om du kör med Docker Compose
cd /path/to/ambmail
docker compose up -d --no-deps app worker

# Eller med start-skript
./start_ambmail.sh
```

## Steg 6: Anslut Nextcloud i Ambmail UI

1. Öppna Ambmail i webbläsaren
2. Gå till **Compose** (skriv nytt mejl)
3. Klicka på **📎 Nextcloud**-knappen
4. Klicka **"Anslut Nextcloud"**
5. Du omdirigeras till Nextcloud för att godkänna
6. Godkänn åtkomst
7. Du omdirigeras tillbaka till Ambmail

Vid lyckad anslutning visas `?nc=connected` i URL:en.

## Steg 7: Verifiera anslutningen

I compose-vyn:
1. Klicka på **Nextcloud**-ikonen igen
2. Du ska nu se dina Nextcloud-filer
3. Testa att:
   - Navigera i mappar
   - Klicka **"Bifoga"** på en fil (laddar ner som bilaga)
   - Klicka **"Länka"** på en fil (skapar delningslänk)

## Felsökning

### `fetch failed` vid OAuth

**Orsak:** Nätverksproblem mellan containrar

**Lösning:**
```bash
# Kontrollera att containrarna kan nå varandra
docker exec ambmail-app ping nextcloud

# Anslut till samma nätverk
docker network connect nextcloud-net ambmail-app
```

### `invalid_client` från Nextcloud

**Orsak:** Fel OAuth Client ID eller mismatchande redirect URI

**Lösning:**
1. Kontrollera att Client ID/Secret i `.env` matchar Nextcloud
2. Kontrollera att redirect URI i Nextcloud matchar exakt:
   - `http://localhost:3000/api/nextcloud/auth/callback` (localhost)
   - `https://ambmail.din-domän.se/api/nextcloud/auth/callback` (extern)

### `Unable to connect` efter godkännande

**Orsak:** Redirect till fel URL (oftast localhost från extern miljö)

**Lösning:**
1. Kontrollera att `AMBMAIL_PUBLIC_URL` är korrekt satt
2. Rensa browser-cache och cookies
3. Testa i inkognitoläge

### TLS/Certifikatfel

**Orsak:** Självsignerade certifikat accepteras inte av Node.js

**Lösning (endast utveckling):**
```env
NODE_TLS_REJECT_UNAUTHORIZED="0"
```

**Lösning (produktion):**
Använd giltiga SSL-certifikat från Let's Encrypt eller liknande.

### OAuth2-app syns inte i Nextcloud

**Orsak:** OAuth2-appen är inte aktiverad

**Lösning:**
```bash
# Kontrollera att OAuth2-appen är aktiv
docker exec nextcloud php /var/www/html/occ app:list | grep oauth2

# Aktivera om nödvändigt
docker exec nextcloud php /var/www/html/occ app:enable oauth2
```

## Säkerhetsöverväganden

### Produktion

- ✅ Använd aldrig `NODE_TLS_REJECT_UNAUTHORIZED="0"` i produktion
- ✅ Använd giltiga SSL-certifikat
- ✅ Begränsa OAuth2 redirect URIs till specifika domäner
- ✅ Använd starka Client Secrets
- ✅ Rotera OAuth2-secrets regelbundet

### Utveckling

- ✅ `NODE_TLS_REJECT_UNAUTHORIZED="0"` är acceptabelt för lokal utveckling
- ✅ Lokala OAuth2-klienter kan ha enklare secrets
- ✅ Dokumentera vilka miljövariabler som är känsliga

## Exempel på komplett .env för Nextcloud-integration

```env
# Nextcloud konfiguration
NC_BASE_URL="http://nextcloud:80"
NC_PUBLIC_URL="https://nextcloud.exempel.se"
AMBMAIL_PUBLIC_URL="https://ambmail.exempel.se"

# OAuth2 klient för extern åtkomst
NC_OAUTH_CLIENT_ID="aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5"
NC_OAUTH_CLIENT_SECRET="xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0eD9cB8aA7"

# OAuth2 klient för localhost (valfritt för utveckling)
NC_OAUTH_CLIENT_ID_LOCAL="zA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1vW2xY3"
NC_OAUTH_CLIENT_SECRET_LOCAL="yX3wV2uT1sR0qP9oN8mL7kJ6iH5gF4eD3cB2aA1"

# TLS (endast utveckling med självsignerade certifikat)
NODE_TLS_REJECT_UNAUTHORIZED="0"
```

## Relaterad dokumentation

- [NEXTCLOUD_AUTENTISERING_OCH_FILATKOMST.md](./NEXTCLOUD_AUTENTISERING_OCH_FILATKOMST.md) - Teknisk beskrivning av flöden
- [README.md](./README.md) - Allmän Ambmail-dokumentation

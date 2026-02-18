# NC_image

Minimal Nextcloud i Docker med:
- MariaDB
- 2 demoanvändare
- OAuth2-klient för mejlklient (default: Uxmail callback)

## 1. Initiera

```bash
cd NC_image
cp .env.example .env
```

Byt lösenord i `.env` innan start.

## 2. Starta Nextcloud

```bash
docker compose up -d
```

Nextcloud kör på: `http://localhost:8084` (eller porten i `NC_PORT`).

## 3. Skapa demoanvändare + OAuth2-klient

```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

Scriptet gör följande:
- väntar tills Nextcloud svarar
- aktiverar `oauth2`-appen
- skapar `demo1` och `demo2` (eller värden från `.env`)
- skapar en OAuth2-klient och sparar output i `secrets/oauth2-client.txt`

## 4. Koppla till din mejlklient

Använd värdena från `secrets/oauth2-client.txt` i klienten:
- `Client ID`
- `Client Secret`
- Authorization/token endpoint från Nextcloud (OAuth2)
- Redirect URI måste matcha `OAUTH_REDIRECT_URI` i `.env`

För Uxmail är standard redirect:
`http://localhost:3000/api/nextcloud/auth/callback`

## Vanliga kommandon

```bash
# Se loggar
docker compose logs -f app

# Stoppa
docker compose down

# Stoppa + rensa volymer (tar bort data)
docker compose down -v
```

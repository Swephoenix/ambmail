# NCauth

Minimal fristaende Nextcloud OAuth-brygga for Uxmail.

## Vad den gor

- Startar OAuth mot Nextcloud (`/auth/start`)
- Hanterar callback (`/auth/callback`)
- Hamtar Nextcloud-anvandarprofil
- Signerar en kortlivad token (`nc_auth_token`) och redirectar tillbaka till Uxmail
- Exponerar verifiering (`POST /auth/verify`) for server-till-server kontroll

## Snabbstart

1. Installera beroenden:

```bash
cd NCauth
npm install
```

2. Skapa env:

```bash
cp .env.example .env
```

3. Fyll i minst:

- `NCAUTH_PUBLIC_URL` (t.ex. `http://192.168.68.55:4010`)
- `NC_BASE_URL` / `NC_PUBLIC_URL` (din Nextcloud)
- `NC_OAUTH_CLIENT_ID`
- `NC_OAUTH_CLIENT_SECRET`
- `UXMAIL_CALLBACK_URL` (endpoint i Uxmail som tar emot `nc_auth_token`)
- `SHARED_SIGNING_SECRET` (maste delas med Uxmail backend)

4. Starta:

```bash
npm run dev
```

## OAuth-flode

1. Uxmail redirectar till:

```text
http://<ncauth-host>:4010/auth/start?return_to=http://<uxmail-host>:3000/api/nextcloud/external/callback
```

2. Nextcloud login + consent.
3. NCauth callbackar, signerar token och redirectar till `return_to` med:

```text
?nc_auth_token=<signed_token>
```

4. Uxmail verifierar signaturen via samma `SHARED_SIGNING_SECRET` eller via `POST /auth/verify`.

## Viktigt

- `ALLOWED_RETURN_ORIGINS` bor sattas i produktion for att undvika open redirect.
- Token som skickas till Uxmail ar kortlivad (`exp` 5 min).
- Hela `oauth`-blocket (access token/refresh token) ingar i den signerade payloaden. Hantera som hemlig data.


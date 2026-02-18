# Nextcloud-autentisering och filåtkomst i Ambmail

Det här dokumentet beskriver hur en användare, efter inloggning via Nextcloud, kan:

- bifoga filer i mejl (via WebDAV)
- skapa och infoga fillänkar i mejl (via Nextcloud Share API)

## Översikt

Flödet i korthet:

1. Användaren klickar **Anslut Nextcloud** i compose.
2. OAuth2-callback körs och Ambmail sparar access token/refresh token + `ncUserId`.
3. Ambmail skapar lokal session för användaren.
4. Compose använder API-endpoints för att:
   - lista filer (WebDAV `PROPFIND`)
   - hämta fil för bilaga (WebDAV `GET`)
   - skapa publik delningslänk (OCS Share API)

## 1. OAuth och koppling av användare

När Nextcloud skickar tillbaka användaren till callback:

- kod växlas mot token
- användarprofil hämtas från Nextcloud
- token sparas i tabellen `NextcloudToken`
- lokal Ambmail-session skapas

Relevanta filer:

- `src/app/api/nextcloud/auth/callback/route.ts`
- `src/app/api/nextcloud/external/callback/route.ts`
- `src/lib/nextcloud.ts`

## 2. Åtkomstkontroll innan Nextcloud-anrop

Alla Nextcloud-endpoints i appen kräver:

- giltig Ambmail-session
- att användaren har kopplad Nextcloud-token
- att token är giltig (refresh görs automatiskt vid behov)

Relevanta filer:

- `src/lib/auth.ts` (`requireUser`)
- `src/lib/nextcloud.ts` (`getValidToken`)
- `src/app/api/nextcloud/files/route.ts`
- `src/app/api/nextcloud/download/route.ts`
- `src/app/api/nextcloud/share/route.ts`

## 3. Lista filer (WebDAV)

När användaren öppnar Nextcloud-modalen i compose hämtas filstruktur via:

- endpoint: `/api/nextcloud/files`
- underliggande Nextcloud-anrop: WebDAV `PROPFIND` mot  
  `/remote.php/dav/files/{ncUserId}/...`

Det gör att användaren kan navigera mappar och välja filer.

## 4. Bifoga fil i mejl (WebDAV + lokal upload-token)

När användaren klickar **bifoga**:

1. Compose anropar `/api/nextcloud/download` med vald sökväg.
2. Servern hämtar filen från Nextcloud via WebDAV `GET`.
3. Filen sparas tillfälligt i `/tmp/ambmail-uploads` med ett internt token-id.
4. Compose lägger till token som bilaga i mejl-draften.
5. Vid `POST /api/mail/send` läses filen från token och skickas via SMTP.

Resultat: filen blir en vanlig mejlbilaga.

## 5. Infoga fillänk i mejl (Share API)

När användaren klickar **länka**:

1. Compose anropar `/api/nextcloud/share` med filsökväg.
2. Servern kallar Nextcloud OCS Share API:
   - `POST /ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`
   - `shareType=3` (publik länk)
3. Returnerad URL infogas i mejltexten.

Resultat: mottagaren får en klickbar länk i mejlet istället för filbilaga.

## 6. Viktiga förutsättningar

För att detta ska fungera i praktiken krävs:

- att OAuth2 i Nextcloud är korrekt konfigurerat
- att användaren godkänt åtkomst i OAuth-flödet
- att filrättigheter i Nextcloud tillåter läsning av vald fil
- att Nextclouds fildelning/Share API är aktivt (för länkar)

Om Share API är avstängt eller policy blockerar publika länkar kommer länk-skapandet att misslyckas, även om fil-listning och nedladdning fungerar.

## 7. Var i UI:t detta används

I compose-komponenten finns två separata handlingar:

- `handleNextcloudAttach` -> bilaga
- `handleNextcloudLink` -> delningslänk

Relevanta filer:

- `src/components/ComposeEmail.tsx`


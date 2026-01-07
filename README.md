# UxMail

UxMail är en modern e-postklient med stöd för flera konton, förhämtning av e-postmeddelanden, automatisk uppdatering och SPA-funktionalitet.

## Funktioner

- **Flera e-postkonton**: Anslut och hantera flera e-postkonton samtidigt
- **Förhämtning**: E-postmeddelanden hämtas automatiskt under splashskärmen
- **Automatisk uppdatering**: Kontrollerar efter nya e-postmeddelanden varje minut
- **SPA-funktionalitet**: Skriv e-post utan sidladdningar
- **Förbättrad e-postinmatning**: Intelligenta förslag och bubblor för e-postadresser
- **SQLite-databas**: Lokal databas för kontoinformation

## Förutsättningar

- Node.js (version 18 eller högre)
- npm eller yarn

## Installation

1. Klona repot:
```bash
git clone https://github.com/Swephoenix/Uxmail.git
cd Uxmail
```

2. Installera beroenden:
```bash
npm install
```

3. Skapa en `.env`-fil baserat på `.env.example`:
```bash
cp .env.example .env
```

4. Initiera databasen:
```bash
npx prisma db push
```

5. Starta utvecklingsservern:
```bash
npm run dev
```

Applikationen kommer att vara tillgänglig på [http://localhost:3000](http://localhost:3000)

## Användning

1. Klicka på "Connect Account" för att lägga till ett e-postkonto
2. Använd "+"-knappen för att skriva ett nytt e-postmeddelande
3. E-postmeddelanden uppdateras automatiskt varje minut
4. E-postmeddelanden förhämtas under splashskärmen för snabbare tillgång

## Utveckling

Projektet är byggt med:
- Next.js 16.1.1
- React 19.2.3
- TypeScript
- Prisma (med SQLite)
- Tailwind CSS
- Lucide React (ikoner)
- Tiptap (rich text editor)

## Deployment

För att bygga projektet för produktion:
```bash
npm run build
npm start
```

## Filstruktur

- `src/app/` - Huvudapplikationen (Next.js App Router)
- `src/components/` - Återanvändbara UI-komponenter
- `prisma/` - Prisma-scheman och databasdefinitioner
- `Newsplash/` - Ny splashskärmskomponent

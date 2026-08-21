# Secure Telegram Shop — Setup Guide

Šī dokumentācija apraksta sistēmas uzstādīšanu no tukša Git repozitorija līdz strādājošam production Telegram veikalam uz Vercel.

> Nekad neievieto reālus tokenus, paroles, `DATABASE_URL` vai encryption keys GitHub repozitorijā. `.env.example` ir tikai mainīgo saraksts un piemērs — Vercel neizmanto tajā ierakstītās vērtības automātiski.

## 1. Arhitektūra

Sistēmai nepieciešami pieci ārējie servisi:

1. GitHub — source code.
2. Vercel — Next.js aplikācija un API endpointi.
3. PostgreSQL — Prisma datubāze.
4. Vercel Blob — produktu un privāto lokāciju attēli.
5. Telegram Bot API — klienta interfeiss.
6. PayPal — wallet papildināšana.

Aplikācija izmanto Node.js 20+, Next.js 16, React 19, Prisma 6 un PostgreSQL.

## 2. Environment variables

Production Vercel projektā jābūt šādiem mainīgajiem:

```text
DATABASE_URL=
BOT_TOKEN=
BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox
ADMIN_SESSION_SECRET=
DATA_ENCRYPTION_KEY=
APP_URL=https://your-domain.vercel.app
CRON_SECRET=
BLOB_READ_WRITE_TOKEN=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

`DATABASE_URL` dod PostgreSQL providers. `BLOB_READ_WRITE_TOKEN` parasti automātiski pievieno Vercel, kad Blob store pieslēgts projektam.

Drošības atslēgas lokāli var ģenerēt ar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Pirmo izmanto `DATA_ENCRYPTION_KEY`; otro var ģenerēt atsevišķi `ADMIN_SESSION_SECRET`, `TELEGRAM_WEBHOOK_SECRET` un `CRON_SECRET`.

`DATA_ENCRYPTION_KEY` saglabā drošā vietā. Ja tā tiek pazaudēta, šifrētos lokāciju datus nevar atgūt.

## 3. Lokālā palaišana

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Aplikācija būs pieejama `http://localhost:3000`.

Telegram webhook lokāli prasa publisku HTTPS adresi, tādēļ development režīmā vajadzīgs HTTPS tunnelis. Production izmanto Vercel URL.

## 4. GitHub

Ieteicams izmantot private repository. Source code drīkst būt GitHub, bet secrets nedrīkst commitot.

Pirms push pārbaudi, ka `.env` nav Git tracking:

```bash
git status
```

## 5. Vercel projekta izveide

1. Vercel izvēlies **Add New → Project**.
2. Importē GitHub repository.
3. Framework jāatpazīst kā Next.js.
4. Pirmais deploy var neizdoties, kamēr nav `DATABASE_URL`; tas ir normāli, jo Prisma build laikā pieslēdzas konfigurētajai PostgreSQL DB.

Build skripts projektā ir:

```text
prisma generate && prisma db push && next build
```

Tas nozīmē, ka deployment laikā Prisma schema tiek sinhronizēta ar pieslēgto DB.

## 6. PostgreSQL

Vercel projektam pieslēdz managed PostgreSQL provideru (piemēram, Prisma Postgres vai citu Vercel Marketplace PostgreSQL).

Pēc integrācijas pārbaudi **Project → Settings → Environment Variables**, vai eksistē ne-tukšs `DATABASE_URL`.

Ja logs rāda:

```text
You must provide a nonempty URL.
The environment variable DATABASE_URL resolved to an empty string.
```

tad Prisma nav problēma — Vercel deployment nesaņem DB connection string.

Tabulas manuāli nav jāveido. `prisma/schema.prisma` definē datu modeli, un `prisma db push` izveido/sinhronizē tabulas.

Galvenās tabulas: User, Admin, AdminSession, LoginAttempt, City, Product, Location, Inventory, Order, WalletTransaction, Payment, ProcessedWebhook, SupportTicket, SupportMessage, Broadcast, AuditLog un Setting.

## 7. Vercel Blob

Vercel projektā izveido/pieslēdz Blob store. Pēc pieslēgšanas projektam jāparādās `BLOB_READ_WRITE_TOKEN`.

Blob NAV datubāze. PostgreSQL glabā ierakstus un attiecības; Blob glabā failus.

Produktu bildes var būt publiski izmantojamas katalogā. Lokāciju bildes tiek uzskatītas par privātu pickup informāciju un tiek glabātas kā private Blob references.

## 8. Admin pirmreizējā konfigurācija

Vercel Environment Variables pievieno:

```text
SEED_ADMIN_EMAIL=your-admin-email
SEED_ADMIN_PASSWORD=strong-password-at-least-12-characters
```

Pēc env izmaiņām veic redeploy.

Atver:

```text
https://YOUR-DOMAIN/admin
```

Ja Admin tabulā vēl nav administratora, sistēma novirza uz `/admin/setup`.

Nospied **Initialize administrator**. Serveris izveido OWNER administratoru no Vercel env vērtībām. Tad pieslēdzies `/admin/login`.

Ja administrators jau eksistē, bet seed credentials tika mainīti, `/admin/setup` ir pieejama **Synchronize administrator credentials** funkcija vienīgā administratora credentials sinhronizēšanai.

Pēc vairākiem neveiksmīgiem login mēģinājumiem rate limiter var uz laiku bloķēt autorizāciju; pagaidi aptuveni 15 minūtes.

## 9. Telegram bota izveide

Telegram atver BotFather un izveido jaunu botu.

No BotFather iegūsti:

- bot token → `BOT_TOKEN`;
- bot username bez `@` → `BOT_USERNAME`.

Vercel Environment Variables pievieno abus un veic redeploy.

Izveido random `TELEGRAM_WEBHOOK_SECRET`, pievieno Vercel un redeploy.

Production webhook endpoint ir:

```text
https://YOUR-DOMAIN/api/telegram
```

Repo ir `scripts/set-telegram-webhook.mjs`, tādēļ webhook vari konfigurēt no lokālā termināļa:

```bash
APP_URL=https://YOUR-DOMAIN \
BOT_TOKEN=YOUR_TOKEN \
TELEGRAM_WEBHOOK_SECRET=YOUR_SECRET \
node scripts/set-telegram-webhook.mjs
```

Webhook statusu var pārbaudīt ar Telegram Bot API `getWebhookInfo`. Pareizā stāvoklī `url` norāda uz `/api/telegram`, `pending_update_count` pēc apstrādes tuvojas 0 un nav aktuāla `last_error_message`.

Ja redzi `Wrong response from the webhook: 401 Unauthorized`, webhook secret Telegram pusē un `TELEGRAM_WEBHOOK_SECRET` Vercel pusē nesakrīt, vai deployment izmanto vecas env vērtības. Pēc env izmaiņām vienmēr redeploy un uzstādi webhook no jauna.

Bota galvenais sākumpunkts ir `/start`. Klientam pēc tam tiek parādīta Telegram keyboard navigācija: Shopping, Add Funds, Account un Support.

Support ziņa:

```text
/support ziņas teksts
```

## 10. PayPal Sandbox

PayPal Developer Dashboard izveido app un sākumā izmanto Sandbox credentials.

Vercel:

```text
PAYPAL_CLIENT_ID=<sandbox client id>
PAYPAL_CLIENT_SECRET=<sandbox secret>
PAYPAL_MODE=sandbox
```

Redeploy.

PayPal Developer Dashboard izveido webhook uz:

```text
https://YOUR-DOMAIN/api/paypal/webhook
```

Abonē vismaz:

```text
PAYMENT.CAPTURE.COMPLETED
```

PayPal piešķir webhook ID. To ievieto:

```text
PAYPAL_WEBHOOK_ID=<webhook id>
```

un redeploy.

Sandbox pirkuma testam izmanto atsevišķu Sandbox Personal/buyer kontu. Nedrīkst maksāt ar tā paša Sandbox Business/seller konta credentials — PayPal tad paziņo, ka seller mēģina nopirkt pats no sevis.

Svarīgi: PayPal success redirect pats par sevi wallet naudu NEPIEVIENO. Balance tiek kreditēts tikai pēc verificēta `PAYMENT.CAPTURE.COMPLETED` webhook.

Kad Sandbox pilnībā pārbaudīts, izveido/izmanto Live credentials, nomaini client ID/secret, live webhook ID un `PAYPAL_MODE=production`, tad redeploy.

## 11. Sākotnējie admin dati

Ieteicamā secība:

1. Cities — pievieno pilsētas.
2. Products — pievieno produktu, cenu, aprakstu un bildi.
3. Locations — izvēlies city, pievieno internal/public name, precīzo adresi, koordinātas, pickup instructions un private image.
4. Inventory — savieno Product + Location un norādi quantity.
5. Pārbaudi, ka City, Product, Location un Inventory ir Active.

Telegram Shopping rāda tikai produktus, kuriem izvēlētajā pilsētā ir aktīva lokācija un aktīvs inventory ar `quantity > 0`.

## 12. Pilns testa scenārijs

Pirms production lietošanas izpildi šo testu:

1. `/start` Telegram.
2. Atver Shopping.
3. Redzi pareizo City.
4. Redzi Product un tā bildi.
5. Add Funds → izvēlies Sandbox PayPal summu.
6. Samaksā ar Sandbox buyer.
7. Pārbaudi admin Payments, ka payment kļūst COMPLETED.
8. Pārbaudi Telegram Account balance.
9. Nopērc produktu.
10. Pārbaudi, ka balance samazinās tieši par produkta DB cenu.
11. Pārbaudi Inventory — quantity samazinās par 1.
12. Telegram pēc pirkuma jāsaņem pickup adrese, koordinātas/instructions un location image.
13. Admin Orders jāparādās orderim.
14. `/support testa ziņa` jāizveido Support ticket admin panelī.

## 13. Broadcast cron

Vercel cron konfigurācija pašlaik izsauc:

```text
/api/cron/broadcasts
```

reizi dienā `0 8 * * *`.

Endpoint pieprasa Vercel cron Authorization ar `CRON_SECRET`. Vienā izpildē tiek apstrādāti līdz 50 lietotājiem un progress saglabāts Broadcast `cursor` laukā.

Vercel Hobby ierobežo cron biežumu; pašreizējais daily cron ir saderīgs ar šo ierobežojumu. Biežākam cron nepieciešams atbilstošs Vercel plāns vai cita scheduler arhitektūra.

## 14. Deployment pēc izmaiņām

Ja GitHub ir pieslēgts Vercel, push/commit uz production branch automātiski rada deployment.

Ja maini tikai Environment Variables, veic **Redeploy**, jo jau palaists deployment nesaņem jaunās env vērtības retroaktīvi.

Pēc UI izmaiņām pārlūkā reizēm nepieciešams hard refresh.

## 15. Backup un drošība

- DB backup konfigurē PostgreSQL providerī.
- Blob un DB ir atsevišķi resursi; DB backup neietver Blob failus.
- Saglabā `DATA_ENCRYPTION_KEY` secrets manager/paroles pārvaldniekā.
- Necommitot `.env`.
- Git repository vēlams private.
- Rotējot Telegram token, atjauno Vercel env, redeploy un uzstādi webhook no jauna.
- Rotējot PayPal secret, atjauno Vercel un redeploy.
- `DATA_ENCRYPTION_KEY` nedrīkst vienkārši nomainīt, kamēr DB ir ar veco key šifrētas Location vērtības; vajadzīga datu re-encryption migrācija.

## 16. Ātrā diagnostika

**Prisma: DATABASE_URL empty** — PostgreSQL integration/env nav pareizi pieslēgta deploymentam.

**Telegram 401 Unauthorized** — webhook secret mismatch; redeploy + setWebhook atkārtoti.

**Telegram nerāda produktu** — pārbaudi Product active, City active, Location active, Inventory active un quantity > 0.

**Product/location image nav redzama** — pārbaudi Blob token, upload rezultātu un vai DB saglabāta image reference.

**PayPal redirect success, bet balance 0** — pārbaudi PayPal webhook event, `PAYPAL_WEBHOOK_ID`, mode un Payments statusu. Redirect nav balance credit mehānisms.

**PayPal seller login error** — Sandbox testā izmantots Business seller konts buyer vietā.

**Admin Invalid credentials or too many attempts** — pārbaudi `SEED_ADMIN_EMAIL/PASSWORD`; ja credentials pareizi, iespējams aktivizēts login rate limit.

**Admin forma Request failed** — Vercel Function logs apskati konkrētā API request statusu; biežākie cēloņi ir DB schema/env, required field vai upload/storage konfigurācija.

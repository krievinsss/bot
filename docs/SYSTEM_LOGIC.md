# Secure Telegram Shop — sistēmas loģika un arhitektūra

Šis dokuments apraksta, kā sistēma strādā iekšēji: datu plūsmas, Telegram, inventory, lokāciju izvēle, wallet, PayPal, orders, support, affiliates, broadcasts, admin panelis un drošības mehānismi.

## 1. Sistēmas mērķis

Klienta galvenais interfeiss ir Telegram bots. Web aplikācijas publiskā daļa nav galvenais veikals; Next.js/Vercel darbojas kā servera/API slānis un nodrošina privātu admin paneli.

Augsta līmeņa plūsma:

```text
Telegram user
    ↓
Telegram Bot API
    ↓ webhook
/api/telegram (Vercel / Next.js)
    ↓
Bot handler / business logic
    ↓
PostgreSQL + Prisma
    ↓
PayPal / Vercel Blob / Telegram API

Admin browser
    ↓
/admin
    ↓ authenticated session
Admin API + server pages
    ↓
PostgreSQL / Blob / Telegram
```

## 2. Tehnoloģijas

- Next.js 16 — server pages, API routes, admin UI.
- React 19 — admin komponentes.
- PostgreSQL — galvenais persistent datastore.
- Prisma 6 — DB ORM/schema.
- Vercel — hosting/serverless execution/cron.
- Vercel Blob — attēlu glabāšana.
- Telegram Bot API — klienta UI.
- PayPal Orders/Webhooks — wallet depositi.
- AES-256-GCM — sensitīvu Location datu šifrēšana.

## 3. Galvenais datu modelis

### User
Telegram lietotājs. Satur `telegramId`, username/name, wallet `balance`, account status, referral parent, referral statistiku, notification status, pending interaction state un activity timestamps.

### Admin / AdminSession / LoginAttempt
Admin konti, server-side sesijas un login rate-limit/audita dati. Admin lomām ir OWNER, ADMIN un SUPPORT.

### City
Publiska pilsēta. Location pieder City.

### Product
Produkta nosaukums, slug, apraksts, DB cena, image URL, category un active status.

### Location
Pickup vieta. Satur City relation un public/internal name, bet precīzā adrese, latitude, longitude un instructions DB tiek glabāti encrypted laukos. Private location image DB glabā Blob pathname/reference.

### Inventory
Savieno vienu Product ar vienu Location. Satur `quantity` un `active`. `(productId, locationId)` kombinācija ir unikāla.

### Order
Pirkuma ieraksts. Satur user/product/location relations, publisko Order ID, product/city snapshot, faktisko cenu, statusu un unikālu idempotency key.

### WalletTransaction
Nemaināms wallet ledger ieraksts ar type, amount, balanceBefore, balanceAfter, reference un reason. Tipi: DEPOSIT, PURCHASE, REFUND, AFFILIATE_REWARD, ADMIN_ADJUSTMENT.

### Payment
PayPal wallet papildināšanas mēģinājums. Satur internal/public IDs, provider order/capture IDs, amount/currency un statusu.

### ProcessedWebhook
Aizsargā pret viena PayPal webhook atkārtotu apstrādi. `(provider,eventId)` ir unikāls.

### SupportTicket / SupportMessage
Support sarakste. Ticket statusi OPEN, WAITING, CLOSED.

### Broadcast
Telegram masveida ziņa ar target, statusu, sent/failed counters un cursor batch apstrādei.

### AuditLog
Drošības/biznesa notikumu audits.

### Setting
JSON konfigurācija pēc key, piemēram affiliate percentage.

## 4. Telegram webhook drošība

Telegram sūta POST uz:

```text
/api/telegram
```

Endpoint neuzticas vienkārši tam, ka request atnāca uz pareizo URL. Tas salīdzina header:

```text
X-Telegram-Bot-Api-Secret-Token
```

ar servera `TELEGRAM_WEBHOOK_SECRET`, izmantojot safe equality salīdzināšanu.

Ja secret nesakrīt, atbilde ir HTTP 401 un update netiek apstrādāts.

Tādēļ Telegram `setWebhook` konfigurācijā un Vercel env jābūt identiskam secret.

## 5. User izveide un `/start`

Katram Telegram update tiek identificēts `from.id`.

Bot handler izsauc user upsert loģiku:

- ja User ar telegramId jau eksistē, tiek atjaunots username, firstName un lastActivity;
- ja neeksistē, tiek izveidots jauns User;
- `/start ref_<telegramId>` gadījumā tiek mēģināts piesaistīt referral parent;
- self-referral netiek atļauts.

`/start` atgriež galveno Telegram keyboard.

## 6. Shopping plūsma

Shopping nav vienkāršs visu Product tabulas ierakstu saraksts.

City tiek rādīta tikai tad, ja tajā ir vismaz viena:

```text
active Location
  + active Inventory
  + quantity > 0
  + active Product
```

Pēc City izvēles tiek atlasīti tikai Product, kuri konkrētajā City ir reāli pieejami pēc tā paša inventory principa.

Product detail rāda:

- product name;
- servera DB cenu;
- city;
- kopējo pieejamo quantity šajā city;
- description;
- product image, ja tāda ir;
- Buy pogu.

Klients nevar noteikt pirkuma cenu ar Telegram callback datiem. Purchase laikā cena vēlreiz tiek paņemta no Product DB.

## 7. Inventory un lokāciju izvēles loģika

Viens Product var būt vairākās Location, izmantojot vairākus Inventory ierakstus.

Purchase laikā sistēma meklē:

```text
productId = izvēlētais produkts
inventory.active = true
inventory.quantity > 0
location.active = true
location.cityId = izvēlētā pilsēta
city.active = true
```

Atbilstošie inventory tiek sakārtoti pēc `quantity DESC`, un tiek izvēlēta lokācija ar lielāko atlikumu.

Tas nozīmē, ka sistēma sadala pirkumus starp pieejamajām lokācijām pēc atlikuma, nevis vienmēr akli izvēlas pirmo Location. Tā samazina iespēju koncentrēt visus klientus vienā punktā, ja vienam produktam ir vairāki pickup punkti.

Svarīga nianse: pašreizējā implementācija neveido absolūtu “viens cilvēks vienā lokācijā noteiktā laika logā” rezervācijas locku. Tā izvēlas lielākā atlikuma inventory un atomiski samazina quantity. Ja nākotnē nepieciešama stingra klientu nesatikšanās politika, Order/Location modelim jāpievieno pickup slot/reservation laiks un occupancy noteikumi.

## 8. Pirkuma transakcija

Pirkums notiek PostgreSQL `Serializable` transaction ar līdz trim retry write-conflict gadījumā.

Secība:

1. Pārbauda `idempotencyKey`. Ja šis Telegram callback jau izveidoja Order, tas netiek izveidots otrreiz.
2. Atrod User un pārbauda ACTIVE statusu.
3. Atrod Product un pārbauda active.
4. Atrod derīgu Inventory/Location.
5. Atomiski debetē User balance tikai tad, ja `balance >= product.price`.
6. Atomiski samazina inventory tikai tad, ja `quantity > 0`.
7. Izveido Order ar snapshot datiem.
8. Izveido PURCHASE WalletTransaction.
9. Ja User ir referral parent, aprēķina affiliate reward.
10. Commit.

Ja jebkurš kritiskais solis neizdodas, transakcija tiek rollbackota.

Telegram callback ID tiek izmantots kā idempotency key (`tg:<callback id>`), tādēļ atkārtota viena un tā paša callback apstrāde nedrīkst dubultā noņemt naudu vai stock.

## 9. Pickup datu atklāšana

Location precīzā adrese, koordinātas un instructions netiek rādīti publiskajā Shopping plūsmā.

Tie DB glabājas šifrēti un tiek decryptoti serverī tikai purchase rezultāta izveides laikā.

Pēc veiksmīga pirkuma Telegram saņem:

- product;
- paid amount;
- city;
- atlikušā wallet balance;
- pickup address;
- coordinates;
- pickup instructions;
- public Order ID;
- Telegram location pin;
- private pickup image, ja pievienota.

Private Blob image tiek server-side nolasīta un attēla bytes tiek uploadoti uz Telegram. Tādēļ klientam nav obligāti jāsaņem publisks Blob URL.

## 10. Wallet modelis

`User.balance` ir aktuālais atlikums. `WalletTransaction` ir finanšu vēsture/ledger.

Normāls deposit:

```text
PayPal completed
→ User.balance + amount
→ WalletTransaction(DEPOSIT)
```

Normāls purchase:

```text
User.balance - Product.price
→ WalletTransaction(PURCHASE, negative amount)
```

Affiliate reward:

```text
Parent.balance + reward
Parent.affiliateBalance + reward
Parent.lifetimeCommission + reward
→ WalletTransaction(AFFILIATE_REWARD)
```

Admin wallet izmaiņām paredzēts ADMIN_ADJUSTMENT tips, lai izmaiņas var auditēt, nevis vienkārši pārrakstīt balance bez vēstures.

## 11. Add Funds / PayPal plūsma

Telegram Add Funds piedāvā preset summas 10/25/50/100 EUR un Custom amount.

Custom summa tiek pieņemta 5–1000 EUR robežās. Pending input stāvoklis tiek glabāts `User.pendingAction`.

Kad summa izvēlēta:

1. DB izveido Payment statusā CREATED.
2. Serveris PayPal izveido order.
3. PayPal order ID tiek saglabāts Payment.
4. Telegram saņem PayPal approval URL.
5. User PayPal lapā apstiprina maksājumu.

Browser success/return NAV wallet kredīta pierādījums.

## 12. PayPal webhook un balance kreditēšana

Wallet tiek papildināts `/api/paypal/webhook` tikai pēc PayPal server-to-server webhook.

Endpoint:

1. verificē PayPal webhook signature;
2. pārbauda ProcessedWebhook, lai event netiktu apstrādāts atkārtoti;
3. transaction ietvaros saglabā event ID;
4. interesējas par `PAYMENT.CAPTURE.COMPLETED`;
5. pēc PayPal order ID atrod mūsu Payment;
6. pārbauda currency un amount pret DB;
7. palielina User.balance;
8. izveido DEPOSIT WalletTransaction;
9. Payment status kļūst COMPLETED un tiek saglabāts capture ID.

Tādēļ PayPal redirect var rādīt “successful”, bet balance vēl īslaicīgi nebūt mainījies, ja webhook vēl nav saņemts/apstrādāts.

## 13. Account

Telegram Account rāda:

- username;
- wallet balance;
- completed/paid order skaitu;
- active order skaitu;
- referral count;
- lifetime commission;
- notifications status;
- account status.

Papildu callbacki ļauj apskatīt pēdējos Orders, affiliate link un pārslēgt notifications.

## 14. Affiliate sistēma

Referral URL forma:

```text
https://t.me/<BOT_USERNAME>?start=ref_<telegramId>
```

Ja jauns User pirmoreiz ienāk ar šo parametru, tiek saglabāts `referralParentId` un parent `referralCount` palielinās.

Pirkuma laikā Setting `affiliatePercent` nosaka komisiju; ja setting nav, pašreizējais fallback ir 5%. Pieļaujamā business logic robeža ir >0 un <=50%.

Reward tiek ieskaitīts referral parent wallet un affiliate statistikā tajā pašā purchase DB transaction.

## 15. Support

Lietotājs Telegram nosūta:

```text
/support mans jautājums
```

Tiek izveidots SupportTicket ar publisku Ticket ID un pirmo SupportMessage ar sender `USER`.

Admin panelī support sadaļa lasa šos ticketus, ļauj sekot statusam/sarakstei. Ticket statusi ir OPEN, WAITING, CLOSED.

## 16. Broadcasts

Admin var sagatavot Broadcast ar title/body, optional image/button, target un statusu.

Statusu plūsma:

```text
DRAFT → QUEUED → SENDING → COMPLETED
                     ↘ FAILED
```

Cron endpoint atrod vecāko QUEUED/SENDING broadcast un vienā izpildē paņem līdz 50 lietotājiem.

Target loģika atbalsta:

- ALL;
- WITH_PURCHASES;
- ACTIVE_CUSTOMERS (last activity 30 dienās);
- CITY:<city name>.

Tiek respektēts User ACTIVE statuss un `notificationEnabled=true`.

Pēc batch tiek saglabāti sent/failed counters un pēdējā User ID cursor. Nākamais cron turpina no cursor.

## 17. Admin autentifikācija

Admin panelis atrodas zem `/admin`.

Paroles DB netiek glabātas plaintext; tiek glabāts password hash. Login rezultātā tiek izmantota server-side AdminSession ar opaque tokenu; browser cookie ir HTTP-only/SameSite, bet DB tiek glabāts token hash.

LoginAttempt ieraksti tiek izmantoti neveiksmīgu login mēģinājumu ierobežošanai.

Pirmā OWNER izveide notiek caur `/admin/setup`, izmantojot server-side `SEED_ADMIN_EMAIL` un `SEED_ADMIN_PASSWORD`. Browser nevar patvaļīgi padot sev OWNER credentials setup endpointam.

## 18. Admin sadaļas

Pašreizējā protected admin zona ietver:

- Dashboard;
- Products;
- Cities;
- Locations;
- Inventory;
- Orders;
- Users;
- Payments;
- Wallet;
- Support;
- Broadcasts;
- Affiliates;
- Audit;
- Settings.

CRUD formu dizains izmanto `Add new` modalus un Edit popupus, lai tabulu skati paliktu kompakti. Tabulām ir filtrēšanas/search iespējas attiecīgajās sadaļās.

Locations Edit ļauj mainīt arī private image; sensitīvie location lauki tiek decryptoti servera pusē admin edit vajadzībām un atkārtoti encrypted saglabāšanas laikā.

## 19. Dashboard

Dashboard apkopo reālus DB datus:

- total / 24h / 7d / 30d revenue;
- order counts;
- average order value;
- payment success;
- users un active users;
- deposits;
- wallet liabilities;
- affiliate commission;
- support;
- inventory health;
- products/cities/locations;
- recent orders/deposits;
- top products/cities;
- 30 dienu revenue un order trend grafikus.

Grafiki ir viegli UI komponenti un neprasa atsevišķu chart dependency.

## 20. Product un Location images

Product image upload saglabā image URL, ko Telegram var izmantot Product detail attēlam.

Location image ir sensitīvāka. DB glabā private Blob pathname/reference. Admin preview iet caur autorizētu servera media mehānismu, bet pēc purchase serveris private Blob nolasa un Telegram nosūta bytes.

Blob glabā failu; PostgreSQL glabā atsauci uz failu un biznesa attiecības.

## 21. Encryption

Sensitīvie Location lauki:

- exact address;
- latitude;
- longitude;
- pickup instructions

tiek šifrēti ar AES-256-GCM.

Encryption key ir tikai servera `DATA_ENCRYPTION_KEY` env. Tas netiek sūtīts browserim.

Key nomaiņa nav vienkāršs env edit: vecie ciphertext ieraksti ir decryptojami tikai ar veco key. Pareiza rotācija prasa migrāciju old key → decrypt → new key encrypt → verify → old key retire.

## 22. Idempotency un concurrency

Divi svarīgākie aizsardzības mehānismi:

### Telegram purchase
`Order.idempotencyKey` ir unique. Viens callback nevar radīt vairākus Order.

### PayPal
`ProcessedWebhook(provider,eventId)` ir unique. Viens PayPal event nevar atkārtoti ieskaitīt wallet.

Purchase izmanto Serializable DB transaction un conditional balance/stock update, lai paralēli requesti neiztērētu vienu inventory vienību vai balance vairākas reizes.

## 23. Snapshot dati Orders

Order saglabā `productNameSnapshot`, `cityNameSnapshot` un `price`.

Tas ir apzināti: ja administrators vēlāk pārsauc Product/City vai maina cenu, vēsturiskais Order saglabā to, kas bija pirkuma brīdī.

## 24. Active statusu nozīme

`active=false` ļauj biznesa objektu paslēpt/deaktivizēt, nezaudējot vēsturiskos datus.

Shopping pieejamība prasa visu ķēdi:

```text
City ACTIVE
Location ACTIVE
Inventory ACTIVE
Inventory quantity > 0
Product ACTIVE
```

Tādēļ, ja Telegram “nav produktu”, vispirms jāpārbauda visa šī ķēde.

## 25. Audit

AuditLog paredzēts sensitīvu/business notikumu pierakstam ar event, actor, target, optional IP hash un metadata.

PayPal successful webhook, piemēram, rada `PAYMENT_RECEIVED` audit event.

Audit mērķis nav glabāt secrets vai plaintext sensitīvus datus, bet dot administratoram izsekojamību.

## 26. Kļūdu modelis

Publiskajiem endpointiem nevajadzētu atdot stack trace vai DB detaļas. Telegram webhook un PayPal webhook serverī logē minimālu kļūdas informāciju, bet klientam atgriež generic `Request failed`.

Telegram purchase lietotājam business kļūdas tiek pārvērstas saprotamos tekstos, piemēram:

- insufficient wallet balance;
- sold out;
- product unavailable;
- account unavailable.

## 27. Kas jāņem vērā nākotnes izstrādē

Ja sistēma aug, prioritāri ieteicams:

1. TOTP/WebAuthn vairāku admin kontu gadījumā.
2. Stingrāka role-based authorization katrai admin darbībai.
3. Pickup time-slot/reservation modelis, ja nepieciešams garantēt klientu nesatikšanos lokācijās.
4. DB migrations (`prisma migrate deploy`) production schema evolution, nevis ilgtermiņā tikai `db push`.
5. Integration testi PayPal webhook idempotency un paralēliem purchases.
6. Monitoring/alerting Vercel, DB un PayPal kļūdām.
7. Backup restore testi.
8. Atsevišķs rate-limit/KV serviss pie liela traffic.

## 28. Īsā biznesa plūsma

```text
ADMIN:
City → Product → Location → Inventory

USER:
/start
→ Shopping
→ City
→ Product
→ Buy

Ja balance nepietiek:
Add Funds
→ Payment CREATED
→ PayPal approval
→ PayPal CAPTURE webhook
→ Payment COMPLETED
→ Wallet DEPOSIT

Purchase:
DB price check
→ stock check
→ wallet debit
→ stock decrement
→ Order
→ Wallet ledger
→ optional affiliate reward
→ decrypt pickup data
→ Telegram address + coordinates + private image

Pēc tam:
Admin redz Order / Wallet / Payment / Inventory / Dashboard statistiku.
```

Šī ir centrālā sistēmas loģika: **PostgreSQL ir vienīgais biznesa patiesības avots; Telegram ir klienta interfeiss; admin panelis ir pārvaldības interfeiss; PayPal webhook ir maksājuma patiesības avots; Blob ir failu storage.**

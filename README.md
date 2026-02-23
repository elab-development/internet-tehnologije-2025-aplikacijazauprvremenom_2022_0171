# Time Manager

Time Manager je fullstack Next.js aplikacija za organizaciju obaveza na jednom mestu:

- to-do liste i zadaci
- kalendarski dogadjaji
- beleske
- podsetnici (toast + browser notifikacije)
- podesavanja naloga i izgleda
- admin upravljanje korisnicima i ulogama

Aplikacija je role-based (`user`, `manager`, `admin`) i optimizovana za srpski interfejs.

## Sta se desava u aplikaciji

Nakon prijave korisnik dolazi na dashboard (`/`) gde vidi osnovne metrike (broj listi, otvoreni zadaci, rok danas) i ulaze u radni prostor (`/tasks`).

U radnom prostoru postoje tabovi:

1. `Zadaci`:
   - kreiranje i upravljanje listama
   - kreiranje/izmena/brisanje zadataka
   - status, prioritet, rok i procena vremena (minuti)
   - pretraga + filteri + paginacija
2. `Kalendar`:
   - dnevni, nedeljni i mesecni prikaz
   - vezivanje dogadjaja za task (opciono)
   - mini pregled izabranog dana
3. `Beleske`:
   - tekstualne beleske sa kategorijama
   - pinovanje i pretraga
4. `Podsetnici`:
   - podsetnici vezani za task ili dogadjaj
   - periodican dispatch dospelih podsetnika na 60s
   - browser Notification API podrzan kada je dozvoljen
5. `Organizacija`:
   - kategorije (boja + naziv)
   - odrzavanje listi i pregled opterecenja po listi/kategoriji
6. `Podesavanja`:
   - profil (ime + email)
   - tema (`system/light/dark`)
   - gustina prikaza (`comfortable/compact`)
   - timezone

## Uloge i dozvole

| Uloga | Mogucnosti |
| --- | --- |
| `user` | Radi sa sopstvenim podacima |
| `manager` | Radi sa sobom + korisnicima iz svog tima (delegiranje kroz izbor clana tima) |
| `admin` | Admin panel: role, aktivacija/deaktivacija, dodela managera, brisanje korisnika |

Vazna pravila u kodu:

- `user` ne moze da menja/obrise entitete koje je za njega kreirao `manager` (osim status update scenarija gde je eksplicitno dozvoljeno).
- `manager` moze da radi samo nad korisnicima koji su mu dodeljeni (`managerId`).
- `admin` pristupa `/admin`, upravlja ulogama i revocira sesije korisnika kada menja kriticne podatke.
- Ako se korisniku skine `manager` uloga, ciste se manager-kreirani timski entiteti i tim se odvezuje.

## Nacini koriscenja

### 1) Licna organizacija (pojedinac)

- registracija i prijava
- kreiranje lista i zadataka
- planiranje kroz kalendar
- beleske za kontekst i ideje
- podsetnici za rokove i obaveze

### 2) Menadzerski rad sa timom

- menadzer na `/tasks` bira clana tima iz dropdown-a
- kreira/azurira obaveze za timskog korisnika
- prati kalendar, beleske, podsetnike i organizaciju po korisniku

### 3) Administracija sistema

- admin na `/admin` upravlja ulogama i statusima naloga
- dodeljuje i uklanja managera korisnicima sa `user` ulogom
- vidi osnovne metrike sistema i odrzava pristup

## Arhitektura (ukratko)

- **Frontend**: Next.js App Router + React 19 + TypeScript
- **UI**: Tailwind CSS 4 + shadcn/base-ui komponente + Remix Icon
- **Auth**: better-auth (`/api/auth/[...all]`) sa email/password login flow-om
- **Baza**: PostgreSQL + Drizzle ORM + SQL migracije (`drizzle/`)
- **API**: route handleri u `app/api/*`
- **RBAC/ACL**: centralizovano u `lib/api-utils.ts`, `lib/roles.ts`, `lib/manager-service.ts`

## API pregled

Glavne rute:

- `GET/POST /api/lists`
- `PATCH/DELETE /api/lists/:id`
- `GET/POST /api/categories`
- `PATCH/DELETE /api/categories/:id`
- `GET/POST /api/tasks`
- `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/events`
- `PATCH/DELETE /api/events/:id`
- `GET/POST /api/notes`
- `PATCH/DELETE /api/notes/:id`
- `GET/POST /api/reminders`
- `PATCH/DELETE /api/reminders/:id`
- `POST /api/reminders/dispatch`
- `GET/PATCH /api/profile`
- `GET/PATCH /api/preferences`
- `GET /api/admin/users`
- `PATCH/DELETE /api/admin/users/:id`

Napomena: vecina list endpointa podrzava query filtere i paginaciju (`page`, `limit`, dodatni filteri po modulu).

## API dokumentacija (OpenAPI + Scalar)

OpenAPI specifikacija se generise alatom `next-openapi-gen`, a interaktivna dokumentacija je dostupna preko Scalar UI na:

- `http://localhost:3000/api-docs`

Generisanje specifikacije:

```bash
pnpm run openapi:generate
```

Generisani fajl:

- `public/openapi.json` (ne commituje se, build ga generise automatski)

Autentikacija u dokumentaciji:

- API koristi cookie session preko better-auth
- security schema je podesena na cookie `better-auth.session_token`

Rute iskljucene iz javne dokumentacije:

- `/api/auth/*`
- `/api/reminders/dispatch`

## Pokretanje projekta

### Preduslovi

- Node.js 20+
- pnpm
- PostgreSQL instanca

### 1. Install

```bash
pnpm install
```

### 2. Konfigurisi `.env`

Potrebne promenljive:

```env
DATABASE_URL=postgres://...
BETTER_AUTH_BASE_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret
```

### 3. Primeni migracije

```bash
pnpm exec drizzle-kit migrate
```

### 4. Pokreni dev server

```bash
pnpm dev
```

App je dostupna na `http://localhost:3000`.

## Pokretanje preko Docker-a (Docker + docker-compose)

### 1. Priprema env promenljivih

Kopiraj template fajlove:

```bash
cp .env.production.example .env.production
cp .env.db.example .env.db
```

`.env.production` je za Next.js/better-auth varijable:

```env
BETTER_AUTH_BASE_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret
ALLOWED_ORIGINS=http://localhost:3000
```

`.env.db` je za PostgreSQL servis:

```env
POSTGRES_DB=iteh_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=iteh
DATABASE_URL=postgresql://postgres:iteh@db:5432/iteh_db
```

Ako koristis eksterni DB servis, postavi `DATABASE_URL` u `.env.production` (override preko `.env.db` vrednosti).
`/.env.production` i `/.env.db` su ignorisani kroz `.gitignore`; za deljenje repozitorijuma koriste se samo `*.example` fajlovi.

### 2. Podizanje aplikacije i baze

```bash
docker compose up --build
```

Sta se desava pri podizanju:

1. Pokrece se `postgres` servis sa perzistentnim volume-om.
2. SQL migracije iz `drizzle/*.sql` se automatski izvrsavaju preko Postgres init mehanizma (`/docker-entrypoint-initdb.d`) pri prvom podizanju baze.
3. Nakon sto je baza zdrava, startuje `app` servis.

Aplikacija: `http://localhost:3000`

Napomena: Postgres init skripte se izvrsavaju samo pri prvom kreiranju baze (prazan volume).  
Ako promenis migracije i zelis ponovnu inicijalizaciju lokalno, obrisi volume i podigni ponovo:

```bash
docker compose down -v
docker compose up --build
```

### 3. Opcioni Adminer (UI za bazu)

`adminer` servis je stavljen pod `tools` profile da ne bude obavezan u svakom startu:

```bash
docker compose --profile tools up --build
```

Adminer UI: `http://localhost:8080`

Login parametri:

- `System`: `PostgreSQL`
- `Server`: `db`
- `Username`: vrednost iz `POSTGRES_USER`
- `Password`: vrednost iz `POSTGRES_PASSWORD`
- `Database`: vrednost iz `POSTGRES_DB`

## Dostupne skripte

```bash
pnpm dev
pnpm openapi:generate
pnpm db:migrate
pnpm test
pnpm build
pnpm start
pnpm lint
```

Napomena: `pnpm build` automatski poziva `pnpm openapi:generate` kroz `prebuild` skriptu.

## Struktura projekta

```text
app/
  (auth)/               # login/register + auth handler
  admin/                # admin stranica
  tasks/                # glavni workspace
  api/                  # backend route handleri
components/             # UI i poslovni paneli
db/                     # drizzle konekcija + schema
drizzle/                # SQL migracije i meta
lib/                    # auth, role, api helperi, servisna logika
```

## Bitne napomene

- `proxy.ts` stiti stranice: neulogovani i deaktivirani nalozi se vracaju na `/login`.
- Podsetnici se dispatch-uju periodicno (60s), a notifikacije zavise od browser dozvole.
- `lib/auth-client.ts` trenutno koristi `http://localhost:3000`; za produkciju uskladiti base URL.

## Bezbednost (minimum 3 zastite)

Implementirane su sledece zastite od cestih napada:

1. **CSRF zastita (cookie session API)**
   - better-auth vec ima ugradjenu CSRF zastitu za `/api/auth/*` (origin/same-site mehanizmi).
   - Dodatno, custom API rute (`/api/*`, osim `/api/auth/*`) imaju centralni origin check za `POST/PUT/PATCH/DELETE` u `proxy.ts` + `lib/security.ts`.
   - Ako mutacioni zahtev sa cookie sesijom nema validan `Origin`, zahtev se odbija sa `403`.
2. **IDOR zastita (kontrola pristupa po resursu)**
   - Centralizovana u `lib/api-utils.ts` kroz `requireActor`, `resolveTargetUserId`, `canActorAccessUser`, `requireAdmin`.
   - Time se sprecava pristup tudjim resursima van dozvola uloga (`user/manager/admin`).
3. **CORS hardening**
   - API koristi striktan allowlist pristup (`request origin`, `BETTER_AUTH_BASE_URL`, opcioni `ALLOWED_ORIGINS`).
   - `OPTIONS` preflight se obraduje centralno i odbija neodobrene origine.
4. **XSS hardening**
   - React podrazumevano escapuje prikaz teksta (bez `dangerouslySetInnerHTML`).
   - Globalni security headeri + CSP su podeseni u `next.config.ts` (`Content-Security-Policy`, `X-Frame-Options`, `nosniff`, itd).
5. **SQL Injection zastita**
   - Upiti se izvrsavaju preko Drizzle ORM parametarskog API-ja i Zod validacije ulaza.
   - Nema string konkatenacije raw SQL upita za korisnicki ulaz.

Opcione env promenljive za CORS:

```env
ALLOWED_ORIGINS=http://localhost:3000,https://tvoj-domen.com
CORS_ALLOWED_HEADERS=Content-Type, Authorization, X-Requested-With
```

## CI pipeline

GitHub Actions workflow se nalazi u:

- `.github/workflows/ci.yml`

Na svaki `push` i `pull_request` pokrece:

1. `pnpm run openapi:generate`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`

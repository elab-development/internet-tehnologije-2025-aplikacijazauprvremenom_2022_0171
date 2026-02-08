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

## Dostupne skripte

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

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

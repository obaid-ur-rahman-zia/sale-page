# Sale Page

Touch-friendly point-of-sale screen with category-wise and sale-wise reporting.
Next.js 16 (App Router) + Prisma + PostgreSQL.

## Getting started

```bash
npm install
cp .env.example .env      # then set DATABASE_URL
npm run db:deploy         # apply migrations
npm run db:seed           # default categories and salesmen
npm run dev
```

- `/` — sale screen (keypad, categories, bill discount, printing)
- `/category-sales` — reports
- `/admin/categories` — add, edit, reorder, deactivate and delete categories

## Database

PostgreSQL. `DATABASE_URL` is read from the environment by both the app and the
Prisma CLI:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salepage?schema=public"
```

If you do not have one locally:

```bash
docker run -d --name salepage-postgres --restart unless-stopped \
  -e POSTGRES_USER=salepage -e POSTGRES_PASSWORD=salepage -e POSTGRES_DB=salepage \
  -p 5432:5432 postgres:16-alpine
```

### Commands

```bash
npm run db:migrate   # create a migration after editing schema.prisma (development)
npm run db:deploy    # apply existing migrations (development and production)
npm run db:seed      # default categories and salesmen
npm run db:studio    # browse the data
```

`db:seed` inserts the categories **Bags, Jewelry, Flags, Decorations, Cloth, Paint,
Others** with hosted images. Re-running it refreshes images only, so names edited from
the admin screen are preserved.

### Prisma version

Pinned to **Prisma 6.19.3**, exact — no caret. Prisma 7 requires a driver adapter for
every datasource and moves the connection URL out of `schema.prisma`, so upgrading is a
deliberate migration rather than a version bump.

## Reports and filters

Filters apply to both report tabs: date range with Today / Yesterday / Last 7 Days /
This Month presets, category, salesman, and a partial sale-ID search.

Two things worth knowing about the numbers:

- **Dates are whole days in `APP_TIME_ZONE`** (default `Asia/Karachi`), not UTC. With
  UTC boundaries a "today" filter in a UTC+5 shop silently dropped every sale made
  before 5am. Set `APP_TIME_ZONE` and `NEXT_PUBLIC_APP_TIME_ZONE` together.
- **Bill discounts are allocated to categories in proportion to amount.** A discount is
  taken on the bill as a whole and stored on `SaleBill`, so a per-category report that
  read `Sale.discount` showed zero discount everywhere. `lib/sales-report.ts` spreads it
  across the bill's lines once, which is what makes the category tab, the sale tab and
  the printed invoice add up to the same net.

With a category filter active, the sale-wise tab shows only that category's share of
each bill, so the two tabs keep tying out.

## Admin access

Open by default. Set `ADMIN_PASSWORD` (and optionally `ADMIN_USER`, default `admin`) to
switch on sign-in — see `proxy.ts`.

The browser sign-in box appears on `/admin` only. Signing in there sets an HttpOnly
session cookie, and the category write endpoints (`POST`/`PATCH`/`DELETE
/api/categories`) accept that cookie, so they are protected without ever raising a
second prompt. `GET /api/categories` stays open because the sale screen needs it.

Category images are entered as URLs. `next.config.ts` allows any `https` host; the API
rejects anything that is not `https://` or a `/path` from `public/`.

## Deployment

The `Dockerfile` builds a standalone image. `DATABASE_URL` must be supplied by the
deployment environment — it is deliberately not baked into the image, and the build
does not need it.

On the first deploy, from a shell inside the running container:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Do not run `prisma generate` in the container: the client is already generated during
the image build, and the container runs as a non-root user that cannot rewrite
`node_modules`.

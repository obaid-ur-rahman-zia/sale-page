# Sale Page

Touch-friendly point-of-sale screen with category-wise and sale-wise reporting.
Next.js 16 (App Router) + Prisma + MongoDB.

## Database: MongoDB

Prisma **requires MongoDB to run as a replica set**. A standalone `mongod` rejects
even a single `create` with `P2031: Prisma needs to perform transactions, which
requires your MongoDB server to be run as a replica set`. MongoDB Atlas is already a
replica set; locally the quickest option is a single-node one in docker:

```bash
docker run -d --name salepage-mongo -p 27018:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec salepage-mongo mongosh --quiet --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Then in `.env` (copy `.env.example`):

```
DATABASE_URL="mongodb://localhost:27018/salepage?directConnection=true"
```

`directConnection=true` skips replica-set discovery, which would otherwise send the
driver to the container-internal host name. Atlas connection strings do not need it.

If you would rather use a MongoDB you already have on `localhost:27017`, add
`replication: { replSetName: rs0 }` to its `mongod.cfg`, restart the service, and run
`rs.initiate()` once — a single-node replica set behaves like a standalone otherwise.

### Prisma version

Pinned to **Prisma 6.19.3**, not 7.x. Prisma 7 requires a driver adapter for every
datasource and no MongoDB adapter exists yet, so v7 can run the CLI but cannot connect
at runtime. Keep the exact pins in `package.json` until `@prisma/adapter-mongodb` ships.

### Commands

```bash
npm run db:push     # apply schema + indexes (MongoDB has no migration history)
npm run db:seed     # default categories and salesmen
npm run db:studio   # browse the data
```

`db:seed` inserts the categories **Bags, Jewelry, Flags, Decorations, Cloth, Paint,
Others** with hosted images. Re-running it refreshes images only, so names edited from
the admin screen are preserved.

## Getting started

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

- `/` — sale screen (keypad, categories, bill discount, printing)
- `/category-sales` — reports
- `/admin/categories` — add, edit, reorder, deactivate and delete categories

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

`/admin/*` and the category write endpoints are open by default. Set `ADMIN_PASSWORD`
(and optionally `ADMIN_USER`, default `admin`) to put HTTP Basic auth in front of them —
see `proxy.ts`. Leaving it unset keeps the current behaviour.

Category images are entered as URLs. `next.config.ts` allows any `https` host; the API
rejects anything that is not `https://` or a `/path` from `public/`.

## Deployment

The `Dockerfile` builds a standalone image. `DATABASE_URL` must be supplied by the
deployment environment and point at a replica set or Atlas — it is deliberately not
baked into the image.

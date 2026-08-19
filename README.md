# portfolio-final

The same platform as the parent directory, restructured to what was asked for: **one backend, one
frontend**.

```
portfolio-final/
├── backend/     Node.js + TypeScript + Express + PostgreSQL  (port 9200)
└── frontend/    Next.js — public site at /, admin panel at /admin  (port 3000)
```

## What changed, and what deliberately did not

| | Parent project | Here |
|---|---|---|
| API | Java 21 / Spring Boot | **Node.js 22 / TypeScript / Express 5** |
| Frontends | two apps (`public-site`, `admin-panel`) | **one app**, admin under `/admin` |
| Database | PostgreSQL, 14 Flyway migrations | **the same 14 SQL files, byte-for-byte** |
| API contract | `openapi.json` from springdoc | **the same document**, served at `/v3/api-docs` |

The schema and the HTTP contract are unchanged on purpose. The migrations were copied rather than
rewritten, so the two implementations cannot drift on data shape, and the Java service's OpenAPI
document was carried over as the specification this backend has to satisfy — the frontend
generates its typed client from it either way.

Every design decision from `../DECISION_LOG.md` is preserved: soft deletes, slug uniqueness scoped
to live rows (D-021), the settings registry in code (D-024), the silent honeypot (D-023),
content-sniffed uploads with required alt text (D-018), analytics that stores no visitor
identifier (D-026), write-time HTML sanitization (D-027), and the notifier seam with no email
provider (D-028).

## Running it

Postgres and Redis come from the parent directory's `docker compose`. The Node backend uses its
own database (`portfolio_node`) so it never fights the Java one for rows.

```bash
# 1. infrastructure (from the parent directory)
cd ..  && docker compose up -d

# 2. create this backend's database, once
docker exec portfolio-postgres-1 psql -U portfolio -d portfolio -c "CREATE DATABASE portfolio_node;"

# 3. API — terminal 1
cd portfolio-final/backend
cp .env.example .env      # first time only
npm install               # first time only
npm run dev               # http://localhost:9200

# 4. app — terminal 2
cd portfolio-final/frontend
cp .env.example .env.local   # first time only
npm install                  # first time only
npm run dev                  # http://localhost:3000
```

Sign in at <http://localhost:3000/admin/login> — `admin@localhost` / `dev-only-password`.

Migrations run automatically at startup; there is no separate step. `npm run migrate` exists for
running them on their own.

## Backend layout

```
backend/src/
├── config/env.ts          all configuration, validated once at startup
├── db/                    pool, transaction helper, migrator + the 14 SQL files
├── common/                envelope, errors, redis + rate limiter, validation, slugs, content factory
├── middleware/            auth guard, error handler
└── modules/               auth, media, technology, project, experience, skill, education,
                           certification, achievement, contact, settings, analytics, blog,
                           notification
```

Two notes on the shape:

- **`common/content.ts`** is a small factory the four simple content modules share (experience,
  education, certification, achievement). They differ only in their columns, not in how a list,
  a soft delete or a media reference behaves — so that behaviour is written once. Projects,
  skills, blog, contact, settings and analytics are hand-written, because each does something the
  others do not.
- **Raw SQL, no ORM.** The constraints in those migrations are the specification; an ORM in front
  of them would add a second, weaker description of the same rules.

## Verification

```bash
cd backend  && npm run typecheck    # strict TypeScript, clean
cd frontend && npm run build        # 32 routes
```

Both were driven end to end in a real browser:

- **43 contract checks** against the Node API — the same behaviours the Java service was held to,
  including no account enumeration, draft invisibility, the honeypot being indistinguishable from
  a real submission, sanitization on write, and analytics storing nothing identifying.
- **12 browser checks** on the merged app — the admin guard, login, session survival across a
  reload, creating and publishing a project, a settings change crossing from `/admin` to `/`, the
  contact form reaching the inbox, and the theme toggle (15.97:1 dark contrast).

## Known gaps

Inherited from the parent, unchanged:

- **No email is sent** (D-028). Password-reset tokens are generated and logged as undelivered, so
  self-service reset does not work end to end.
- **Media is chosen by id** in admin forms; the Media library shows each file's id.
- The Research module (D-014) was never scheduled and is not built.
- The site renders empty until real content is added.

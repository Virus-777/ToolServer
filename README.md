# TailorResume Auth Server

Backend API and admin dashboard ("KingMaker") for the TailorResume / JobBidAssist client application.
It manages users and their access, the daily job feed, block lists, per-user configuration,
the GPT model selection and an audit log.

## Tech Stack

| Layer     | Technology                                             |
| --------- | ------------------------------------------------------ |
| Runtime   | Node.js 18+ (packaged with `pkg` for distribution)     |
| API       | Express 5, Passport JWT, bcryptjs                       |
| Database  | PostgreSQL (`pg` connection pool)                       |
| Dashboard | React 18, Vite 5, Tailwind CSS 3 (built into `public/`) |

## Quick Start

```bash
npm install
cp .env.example .env        # fill in PostgreSQL credentials and JWT_SECRET
npm start                   # creates/updates the schema, then listens on PORT (default 8085)
```

Open `http://localhost:8085` for the dashboard. The first account registered through
`POST /api/admin/register` (or the "Add User" button) becomes an administrator.

Development:

```bash
npm run dev                 # backend with nodemon
npm run frontend:install    # once
npm run frontend:dev        # Vite dev server on http://localhost:3003 (proxies /api to 8085)
npm run frontend:build      # rebuilds public/ (commit the result, the server serves it)
```

Other scripts: `npm run check` (syntax check), `npm run setup` (schema only),
`npm run import:bid [file.xlsx]` (import jobs from a bid spreadsheet), `npm run build:win`
(standalone executable, see below).

## Configuration

All settings come from environment variables (`.env` in development, `config/production.config.js`
embedded in the executable). See `.env.example` for the full list.

| Variable                                   | Default                        | Purpose                                              |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------- |
| `PORT`                                     | `8085`                         | HTTP port                                            |
| `PG_HOST` `PG_PORT` `PG_USER` `PG_PASSWORD` `PG_DATABASE` | required        | PostgreSQL connection (database is created if missing) |
| `PG_POOL_MAX`, `PG_CONNECT_TIMEOUT_MS`     | `20`, `5000`                   | Connection pool tuning                               |
| `JWT_SECRET`                               | built-in default               | Legacy tokens; also the fallback for the two below   |
| `JWT_ADMIN_SECRET`, `JWT_USER_SECRET`      | falls back to `JWT_SECRET`     | Dashboard tokens / client-app tokens                 |
| `JWT_EXPIRES_IN`                           | `24h`                          | Token lifetime                                       |
| `CORS_ORIGIN`                              | any origin                     | Comma separated allow-list                           |
| `BODY_LIMIT`                               | `500kb`                        | Max request body                                     |
| `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`        | `http://127.0.0.1:11434/v1`    | Gateway behind `POST /api/gpt/responses`             |
| `STARTUP_AUTH_ENABLED` (+ `STARTUP_PASSWORD…`) | off                        | Optional interactive password prompt at start-up     |
| `NODE_ENV`                                 |                                | `production` switches request logs to `combined`     |

Signing and verification always use the same secret resolution
(`JWT_ADMIN_SECRET → JWT_SECRET → default`), so a `.env` that only defines `JWT_SECRET` works.

## Project Structure

```
index.js                  Bootstrap: env, optional startup auth, schema setup, listen, graceful shutdown
app.js                    Express app factory (middleware, routers, static dashboard, error handler)
config/
  env.js                  Loads .env or the embedded production config
  auth.js                 JWT secrets/signing + password hashing
  passport.js             admin-jwt / user-jwt / jwt strategies
  constants.js            Shared enums (industries, history actions, setting keys, pagination)
  gpt-models.js           Selectable model catalog with pricing
controllers/              One module per resource, thin request/response handling
routers/                  Route tables and auth middleware per resource
database/
  db.js                   Connection pool
  setup.js                Idempotent schema (CREATE/ALTER/INDEX IF NOT EXISTS)
  model.js                Facade re-exporting database/models/*
  models/                 SQL per table (users, settings, configs, jobs, block-list, history, ...)
utils/
  auth.middleware.js      Validation + passport wrappers + allowed-email guard
  history.js              logHistory(req, {...}) audit helper (never throws)
  url.utils.js            Job URL normalisation (duplicate / block matching)
  date.utils.js, utils.js, ip.utils.js, startup-auth.js
scripts/                  CLI helpers (bid import, password hash)
frontend/                 React dashboard source (built into public/)
public/                   Built dashboard served by Express
```

## API Overview

Three token families exist, each verified by its own Passport strategy:

| Prefix        | Login endpoint            | Used by                    | Middleware          |
| ------------- | ------------------------- | -------------------------- | ------------------- |
| `/api/admin`  | `POST /api/admin/login`   | Dashboard (admins only)    | `authenticateAdmin` |
| `/api/user`   | `POST /api/user/login`    | Client application         | `authenticateUser`  |
| `/api/auth`   | `POST /api/auth/login`    | Legacy clients             | `authenticate`      |

Send tokens as `Authorization: Bearer <token>`. Errors are always `{ "error": "message" }`.

| Resource         | Endpoints                                                                                          | Auth                          |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| Health           | `GET /api/health`                                                                                  | public                        |
| Admin auth       | `POST /api/admin/login`, `POST /api/admin/register`, `GET /api/admin/verify`                       | public / admin                |
| User auth        | `POST /api/user/login`, `POST /api/user/register`, `GET /api/user/verify`, `GET|POST /api/user/assembly-token` | public / user / legacy |
| Users (legacy)   | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/verify`, `GET /api/auth/`, `GET|PUT|DELETE /api/auth/:id`, `PATCH /api/auth/:id/block` | public / admin |
| IP lookup        | `GET /api/ips/lookup/:ip`                                                                          | public                        |
| Jobs             | `GET|POST /api/jobs`, `GET /api/jobs/today`, `DELETE /api/jobs/by-date?date=YYYY-MM-DD`, `GET|PUT|DELETE /api/jobs/:id` | public |
| Block list       | `GET|POST /api/block-list`, `GET|PUT|DELETE /api/block-list/:id`                                   | public                        |
| User configs     | `GET /api/config/all`, `POST /api/config/{prompt,resume,template,folder}`, `GET /api/config/{prompt,resume,template,folder}/:email`, `GET|DELETE /api/config/:email` | public |
| GPT              | `GET /api/gpt/models`, `GET|POST /api/gpt/selected`, `GET|POST /api/gpt/apikey`, `POST /api/gpt/responses` | admin (selected GET + responses public) |
| Settings         | `GET|POST /api/settings`, `GET /api/settings/key/:key`, `GET|PUT|DELETE /api/settings/:id`         | legacy + allowed email        |
| History          | `GET /api/history`, `GET /api/history/:id`                                                         | admin                         |
| Allowed emails   | `GET|POST /api/allowed-emails`, `GET|PUT|DELETE /api/allowed-emails/:id`                           | admin                         |
| Assembly tokens  | `GET|POST /api/assembly-tokens`, `GET|PUT|DELETE /api/assembly-tokens/:id`                         | admin                         |

### Jobs

`GET /api/jobs` accepts `date` (YYYY-MM-DD), `industry` (`0` software, `1` civil), `search`
(matches title, company, tech, summary and description), `page`, `limit` (max 10000) and
`orderDirection` (`ASC`/`DESC`). It returns `{ jobs, pagination: { page, limit, total, totalPages } }`.

```http
POST /api/jobs
Content-Type: application/json

{
  "title": "Senior Developer",        // required
  "company": "Tech Corp",             // required
  "date": "2026-09-25",               // required
  "industry": 0,                      // optional, 0 = software (default), 1 = civil
  "tech": "React, Node.js",
  "url": "https://example.com/job/1", // validated and normalised for duplicate/block checks
  "summary": "Two sentences about the role",
  "description": "Full posting text"
}
```

Jobs whose company or URL matches the block list are rejected with `403`.

### GPT model

`GET /api/gpt/models` returns `{ models: [{ id, name, family, pricing: { input, cached, output }, description }] }`
(prices in USD per 1M tokens). The selected model is stored in the `settings` table under
`selected_gpt_model` and read by the client through the public `GET /api/gpt/selected`.

## Database

The schema is created and migrated automatically on start-up (`database/setup.js`); every
statement is idempotent, so existing data is never touched. Tables: `users`, `settings`,
`user_configs`, `jobs` (incl. `industry` and `summary` columns added via
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`), `block_list`, `history`, `allowed_emails`,
`assembly_tokens`. Indexes cover the hot paths (`jobs(date, industry)`, `history(created_at)`,
`history(user_id)`).

## Building the Executable

```bash
cp config/production.config.template.js config/production.config.js   # fill in real values
npm run frontend:build
npm run build:win          # dist/TailorResumeAuthServer-win.exe (also build:linux / build:mac / build:all)
```

Icon and version metadata live in `resources/` and `pkg-config.json` (see `resources/README.md`).

## Operations

- `GET /api/health` reports database connectivity (`503` when the database is unreachable).
- Hashed dashboard assets are served with immutable caching; `index.html` is always revalidated.
- `SIGINT` / `SIGTERM` trigger a graceful shutdown (in-flight requests finish, pool is closed).
- Every mutating request is written to the `history` table with the acting user and client IP.

## License

Copyright (C) 2024 TailorResume. All rights reserved. This software is proprietary and confidential.

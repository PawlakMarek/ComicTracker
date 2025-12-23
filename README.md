# ComicTracker

Production-ready comic reading tracker centered on story blocks (arcs/runs/events). Designed for massive libraries, character/team focus, session-based tracking, and fatigue-aware suggestions.

## Stack
- Backend: Fastify (TypeScript), Prisma ORM, PostgreSQL
- Frontend: React (Vite) + Tailwind CSS
- Auth: Email/password with bcrypt + JWT in HttpOnly cookies
- Import: CSV/JSON with column mapping and preview

## Quick Start (Docker)
1. Ensure Docker is running.
2. Build and run everything:

```bash
docker compose up --build
```

3. Open the app at `http://localhost:3000`.

The API runs on `http://localhost:3001` inside the compose network. Nginx proxies `/api` from the web container to the API.

## Local Development (without Docker)
- API
  ```bash
  cd apps/api
  npm install
  cp .env.example .env
  npm run prisma:generate
  npm run prisma:migrate
  npm run dev
  ```

- Web
  ```bash
  cd apps/web
  npm install
  npm run dev
  ```

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret (min 16 chars)
- `COOKIE_SECRET`: Cookie signing secret (min 16 chars)
- `API_PORT`: API port (default 3001)
- `WEB_ORIGIN`: Frontend origin for CORS (comma-separated allowed)
- `COOKIE_SAMESITE`: `lax` (default), `strict`, or `none`
- `COOKIE_DOMAIN`: Optional cookie domain for subdomain deployments (e.g. `.example.com`)
- `COOKIE_SECURE`: Optional override for cookie `secure` flag (`true`/`false`)
- `VITE_API_URL`: Optional API base for the frontend (leave empty to use `/api`)

## Migrations
- Local dev: `npm run prisma:migrate`
- Docker: the API container runs `prisma migrate deploy` on startup.

## API Documentation
See `docs/api.md`.

## Import Format
See `docs/import-format.md`.

## Integrations
- ComicVine import tooling is available under `Tools` in the UI. Add your API key there before searching.
- Network access is required for ComicVine requests.

## Notes
- No business data is seeded. All data must be imported or created via the UI.
- Development-only scripts can be added, but no production seeds are included.

## Production Deployment (Railway + Neon)
### Neon (Postgres)
1. Create a Neon project and database.
2. Copy the connection string and ensure it includes TLS (e.g. `?sslmode=require`).

### Railway (API + Web)
Railway works best with two services from the same GitHub repo:

1. **API service**
   - Root directory: `apps/api`
   - Dockerfile path: `apps/api/Dockerfile`
   - Variables:
     - `DATABASE_URL` (Neon connection string)
     - `JWT_SECRET`, `COOKIE_SECRET`
     - `WEB_ORIGIN` (your web domain, e.g. `https://comictracker-web.up.railway.app`)
     - `COOKIE_SAMESITE=none` if the API and web are on different domains
     - `COOKIE_DOMAIN=.yourdomain.com` if you use subdomains and want a shared cookie
     - `NODE_ENV=production`

2. **Web service**
   - Root directory: `apps/web`
   - Dockerfile path: `apps/web/Dockerfile`
   - Build arg:
     - `VITE_API_URL=https://<your-api-domain>` (so the SPA calls the API directly)

### Self-hosted
Use `docker compose up --build` and set the same env vars via `.env`.

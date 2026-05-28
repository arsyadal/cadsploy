# Cadsploy

Docker-first self-hosted deployment platform MVP.

## Stack

- `apps/web`: Next.js dashboard
- `apps/api`: Fastify API, GitHub OAuth, Prisma, BullMQ
- `apps/worker`: deploy worker, Git clone, Docker/Nixpacks build, container runtime, Caddyfile generation
- PostgreSQL + Redis via Docker Compose

## Quick Start

```bash
cp .env.example .env
npm install
npm run prisma:generate
docker compose up -d
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## Required local tools for real deployments

- Docker Engine
- Git
- Nixpacks, only if using auto-detect mode
- Caddy, if you want generated reverse proxy config to be reloaded

Create the Docker network once, or let worker create it:

```bash
docker network create cadsploy-net
```

## GitHub OAuth

Create a GitHub OAuth App and set:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:4000/auth/github/callback
PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## MVP flow

1. Login with GitHub.
2. Import repository.
3. Choose branch, build method, and app port.
4. Click Deploy.
5. Worker clones repo, builds Docker image, runs container, writes generated Caddyfile.
6. Dashboard shows build/runtime logs.

## Notes

- Secrets are encrypted with `ENCRYPTION_KEY` using AES-256-GCM.
- API endpoints enforce ownership checks.
- Containers run with CPU/RAM limits and `no-new-privileges`.
- This is an MVP scaffold; run it first in a private VPS/local lab before opening public access.

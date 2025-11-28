# Docker Deployment Guide

## Quick Start

### 1. Prepare Environment File

Ensure you have `.env` file in the project root directory. If not, copy from example:

```bash
# From project root
cp .env.example .env
```

Then edit `.env` and configure:
- `BETTER_AUTH_SECRET` - Generate with: `npx @better-auth/cli@latest secret`
- `POSTGRES_URL=postgres://chatpie:chatpie123@piedb:5432/chatpie` (use `piedb` for Docker)
- `BETTER_AUTH_URL=http://localhost:8300` (must match how you access the app)
- Other settings as needed

### 2. Start Services

```bash
# Build and start all services
pnpm docker-compose:up

# View logs
pnpm docker-compose:logs

# Check status
pnpm docker-compose:ps
```

### 3. Access Application

Open your browser: http://localhost:8300

### 4. Stop Services

```bash
pnpm docker-compose:down
```

---

## Environment Configuration for Docker

### Required Settings

| Variable | Value for Docker | Description |
|----------|------------------|-------------|
| `POSTGRES_URL` | `postgres://chatpie:chatpie123@piedb:5432/chatpie` | Use `piedb` (container name) |
| `POSTGRES_USER` | `chatpie` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `chatpie123` | PostgreSQL password |
| `POSTGRES_DB` | `chatpie` | Database name |
| `BETTER_AUTH_URL` | `http://localhost:8300` | Must match browser access URL |
| `NO_HTTPS` | `1` | Required for Docker |
| `BETTER_AUTH_SECRET` | (generate) | Auth secret key |

### Accessing from Other Devices

To access from another device on your network:

1. Find server IP (e.g., `192.168.1.100`)
2. Update `.env`:
   ```env
   BETTER_AUTH_URL=http://192.168.1.100:8300
   ```
3. Restart: `pnpm docker-compose:down && pnpm docker-compose:up`
4. Access from other devices: `http://192.168.1.100:8300`

---

## Troubleshooting

### Login fails with "Invalid origin" error

**Error:** `Invalid origin: http://127.0.0.1:8300`

**Fix:** Ensure `BETTER_AUTH_URL` matches your browser URL:
```env
BETTER_AUTH_URL=http://localhost:8300
```

### Database connection fails

**Check:**
1. PostgreSQL running: `pnpm docker-compose:ps`
2. `POSTGRES_URL` uses `piedb` not `localhost`
3. Credentials match in `.env`

### Port conflict

Change port in `compose.yml`:
```yaml
ports:
  - '8301:8300'
```
Update `BETTER_AUTH_URL` accordingly.

---

## Update to Latest Version

```bash
pnpm docker-compose:update
```

This pulls latest code, rebuilds images, and restarts services.

---

## Data Management

PostgreSQL data persists in volume `chatpie_postgres_data`.

To reset database:
```bash
pnpm docker-compose:down
docker volume rm chatpie_postgres_data
pnpm docker-compose:up
```

**⚠️ Warning:** This deletes all data permanently.

# Todos

Minimal nested todo app — dark theme, multi-user with email/password auth.

## Run

```bash
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173)

On first run, the `ollama-init` service pulls the `llama3.2:1b` model (~1.3 GB). This may take a few minutes.

Sign up with email and password (min 8 characters). Each user sees only their own tasks.

## Auth

- **Sign up / sign in** — minimal screen on first visit
- **Sign out** — top-right on the todo screen
- Sessions use an httpOnly cookie (JWT, 7-day default)
- **Production sign-up** requires a shared invite code (`REGISTRATION_CODE` in `.env`)
- Copy `.env.example` to `.env` and set secrets before production

### Generate an invite code

The code is a plain secret string friends enter at sign-up. A 64-character hex string works well (same shape as a SHA-256 hash):

```bash
openssl rand -hex 32
```

Put the output in `.env` as `REGISTRATION_CODE=...` and share it privately with friends and family.

## Emoji AI

Each new todo gets an emoji suggested by **Ollama** running locally in Docker — no API keys or paid services.

- Suggestion is based on the **title only**
- Click the emoji to open a searchable picker and choose a different one
- Falls back to 📋 if Ollama isn't ready yet

Optional: copy `.env.example` to `.env` to change `OLLAMA_MODEL`.

## Dev (without Docker)

Terminal 1 — MongoDB (or use Docker for mongo only):

```bash
docker compose up mongo
```

Terminal 2 — API:

```bash
cd server && npm install && npm run dev
```

Terminal 3 — Client:

```bash
cd client && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (Vite dev server proxies `/api` to port 3001).

Local dev does not require an invite code unless you set `REGISTRATION_CODE` in your environment.

## Tests

```bash
cd server && npm test
cd client && npm run build
```

## Migrate local todos to production

Merge-import tasks from local Mongo into your prod account (keeps existing prod todos).

**1. Local user ID**

```bash
docker exec todo-app-mongo-1 mongosh todos --quiet --eval '
db.users.findOne({ email: "you@example.com" }, { _id: 1 })
'
```

**2. Export local todos**

```bash
docker exec todo-app-mongo-1 mongosh todos --quiet --eval "
EJSON.stringify(
  db.todos.find({ userId: ObjectId('LOCAL_USER_ID') }).toArray()
)
" > todos-export.json
```

**3. Prod user ID** (on VPS)

```bash
docker exec todo-app-mongo-1 mongosh todos --quiet --eval '
db.users.findOne({ email: "you@example.com" }, { _id: 1 })
'
```

**4. Copy export to VPS**

```bash
scp todos-export.json root@YOUR_VPS:~/todo-app/
```

**5. Import on VPS** (from `~/todo-app`, replaces `PROD_USER_ID`)

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -v "$(pwd)/todos-export.json:/data/todos-export.json:ro" \
  -v "$(pwd)/server:/app" -w /app \
  node:22-alpine sh -c "npm ci && MONGODB_URI=mongodb://mongo:27017/todos npx tsx scripts/migrate-todos.ts --file /data/todos-export.json --user-id PROD_USER_ID"
```

Add `--dry-run` before the closing quote to preview without writing. New `_id`s and `parentId` links are remapped; prod todos are not deleted.

## Versioning

The app version is shown vertically on the right edge of the UI (e.g. `v1.1.0`). It comes from the root [`package.json`](package.json).

On every push to **`main`**, [semantic-release](https://github.com/semantic-release/semantic-release) analyzes commits and bumps the version:

| Commit | Bump |
|--------|------|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` | major |
| `chore:`, `docs:`, etc. | no release |

Use [Conventional Commits](https://www.conventionalcommits.org/) on PR titles or squash-merge messages, e.g.:

```
feat: add cyberpunk version stamp
fix: correct todo reorder on mobile
```

**Baseline:** before the first automated release, tag the current state:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## CI/CD

**Pull requests** run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (test + build).

**Push to `main`** runs [`.github/workflows/main.yml`](.github/workflows/main.yml):

1. Server — test + build
2. Client — build
3. Docker — prod compose build
4. Release — semantic-release (version bump + GitHub tag; `[skip ci]` on release commit)
5. Deploy — SSH to VPS, `git pull`, `docker compose up --build -d`

Manual deploy only: **Actions → Deploy → Run workflow** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

Required GitHub secrets:

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | VPS hostname or IP |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private SSH key |
| `DEPLOY_PATH` | Optional app directory on VPS (default `~/todo-app`) |

## Production deploy (single VPS)

Everything runs on one server: **Caddy + client + API + MongoDB + Ollama**.

Recommended: **≥8 GB RAM** (e.g. Hetzner CX32) — Ollama, Mongo, and Node together need headroom.

1. Push repo to GitHub
2. Buy a domain; point a subdomain A record at your VPS IP
3. Hetzner VPS: install Docker Compose; firewall **22, 80, 443** only
4. Clone repo; create `.env`:

```env
DOMAIN=todos.yourdomain.com
JWT_SECRET=<openssl rand -hex 32>
REGISTRATION_CODE=<openssl rand -hex 32>
JWT_EXPIRES_IN=7d
OLLAMA_MODEL=llama3.2:1b
```

5. Deploy:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

6. Wait for `ollama-init` to pull the model on first run
7. Share the subdomain + invite code only with trusted people

MongoDB data persists in the `mongo_data` Docker volume. Back it up periodically with `mongodump` if you care about recovery.

Auth endpoints are rate-limited (login: 10 / 15 min per IP; register: 5 / hour per IP).

## Features

- Unlimited nested sub-tasks
- Notes under each title
- Collapsible branches (state saved in browser)
- Mark tasks done
- AI-suggested emoji per task (Ollama)
- Per-user data isolation
- Mobile-friendly dark UI

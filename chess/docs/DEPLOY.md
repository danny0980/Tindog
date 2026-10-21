# Deploying Chronos Chess

One Node process serves everything from a single origin:
- the built app;
- the JSON API;
- the `/ws` socket for ranked play, Card Chess, Battle Royale and Vanishing Chess.

Everything players create lives in one SQLite database. Put the server behind any HTTPS front end; Caddy is included below.

## The quick way: Docker + Caddy (automatic HTTPS)

```bash
cp server/.env.example server/.env        # then edit it (see "Settings")
DOMAIN=chess.example.com docker compose -f deploy/docker-compose.yml up -d --build
```

- **What this starts.**
  - The `chess` container: the game server, built by the `Dockerfile`.
  - The `caddy` container: it gets a Let's Encrypt certificate for `DOMAIN`, compresses responses, and passes `/ws` upgrades through.
- **Where the data lives.** Both are in the `chess-data` volume, mounted at `/data`:
  - `/data/chess.db` is the database;
  - `/data/backups/` holds the daily backups.
- **The image itself.** It runs as the unprivileged `node` user, on Node 22 (`node:22-bookworm-slim`). Its `node_modules` holds only the server's packages, about 35 MB on top of the base image and the built app. A `HEALTHCHECK` polls `/api/health`.
- **Restarts and readiness.** Both services restart on their own. Caddy waits for the game server's health check before serving, and the server gets 15 seconds to stop cleanly on a deploy.

Without Compose:

```bash
docker build -t chronos-chess .
docker run -d -p 8787:8787 -v chess-data:/data --env-file server/.env chronos-chess
```

## Without Docker

```bash
npm ci                 # full install: the build needs Vite, TypeScript and the browser packages
npm run build:all      # dist/ (the app) and dist-server/ (the server bundle)
npm prune --omit=dev   # optional: keep only what the server needs at runtime
NODE_ENV=production npm start
```

- **What `npm start` runs.** It runs `node dist-server/index.mjs`, a single bundle of the server and the shared rules code. Only the `dependencies` in `package.json` are needed at runtime.
- **Browser-only packages.** React, three.js, Stockfish and the rest are `devDependencies`, because they are compiled into `dist/` at build time.
- **Running from source.** `npm run server:prod` runs the server from source with `tsx` instead, which needs the full install.
- **Keeping it running.** Run the server under systemd so it restarts after a crash and at boot. `deploy/chronos-chess.service` is a ready unit: it restarts always, sandboxes the process, keeps the database in `/var/lib/chronos-chess`, and sends its log to `journalctl -u chronos-chess`.

## Before going live: `npm run doctor`

```bash
npm run doctor                          # from source
node dist-server/cli.mjs doctor --smtp  # in the image; --smtp also logs in to the mail server
```

It checks everything a deployment needs and exits non-zero if something is wrong:
- the mode and public address;
- that the database opens, and its schema version;
- which sign-in methods are on;
- that the built app is there;
- backups;
- with `--smtp`, that the mail server accepts the login.

It also prints the warnings the server prints when it starts.

## Settings

Set these in `server/.env` or in the environment. Every setting is documented in `server/.env.example`.

| Setting | Required | Default | What it does |
| --- | --- | --- | --- |
| `PUBLIC_URL` | **yes** (production) | — | The origin players open, e.g. `https://chess.example.com`. Used for sign-in links and the Origin checks (CSRF and the socket). |
| `SMTP_URL` / `MAIL_FROM` | one of the two sign-ins | — | Email magic links. |
| `GOOGLE_CLIENT_ID` | one of the two sign-ins | — | Google Sign-In. |
| `DATABASE_FILE` | no | `server-data/chess.db` | The SQLite database. In Docker this is `/data/chess.db`. |
| `LEGACY_DATA_FILE` | no | `server-data/db.json` | The JSON data file from 6.14 and earlier, imported once (see below). |
| `BACKUP_DIR` | no | `backups/` next to the database (production) | Where automatic backups go; `off` switches them off. |
| `BACKUP_HOURS` / `BACKUP_KEEP` | no | `24` / `7` | How often to back up, and how many backups to keep. |
| `TRUST_PROXY` | no | `1` in production | How many proxies sit in front, so rate limits see the real client IP. Use `0` when nothing is in front. |
| `PORT` / `HOST` | no | `8787` / `0.0.0.0` | Where the server listens. |
| `SESSION_DAYS` | no | `30` | How long a sign-in lasts; a sign-in used in its second half is renewed for the full term. |
| `APP_ORIGINS` | no | Capacitor's origins | The iOS / Android apps' origins (`capacitor://localhost`, `https://localhost`), allowed to call the API and open the socket. `off` if you don't ship the apps. See `docs/MOBILE.md`. |

The server refuses to start in production without `PUBLIC_URL` and at least one sign-in method, or with an `SMTP_URL` that isn't `smtp://` or `smtps://`. It starts, but warns, when:
- `PUBLIC_URL` is plain http (Secure cookies would be dropped);
- the Google client id doesn't end in `.apps.googleusercontent.com`;
- `MAIL_FROM` still says localhost;
- backups are off.

## Security

In production the server sends these headers:
- **`Content-Security-Policy`** allows:
  - our own scripts;
  - the inline boot script, by its SHA-256 hash only;
  - WebAssembly, for Stockfish;
  - Google Sign-In and Google Fonts;
  - connections to this origin and the PeerJS broker (friend games).
- **No framing:** `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- **HSTS** when `PUBLIC_URL` is https.
- **Other headers:** `nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy` and COOP `same-origin-allow-popups`.

Other protections:
- **Caching.** Hashed assets are cached for a year; the engine files for a week; the page itself is revalidated on every load.
- **Sessions.** Session cookies are httpOnly, SameSite=Lax and Secure, and only their SHA-256 is stored.
- **Origin checks.** Every change and every socket must come from `PUBLIC_URL`, or from the apps' origins (`APP_ORIGINS`).
- **The apps.** The iOS / Android apps can't use the cookie, so they sign in with a token:
  - the server returns it in the sign-in answer, only to a client that says it is the app (`x-chronos-client: native`);
  - the app sends it as `Authorization: Bearer …`, and to the socket as the subprotocol `chronos.token.…`;
  - CORS answers only the apps' origins, never other sites.
- **Sign-in codes.** Every sign-in email also carries a 6-digit code, for the apps (or another device). It expires with the link, works once, and guesses are limited to 8 per address per 15 minutes.
- **Rate limits.**
  - Sign-in emails: per address and per IP.
  - API changes: 240 a minute per IP.
  - Socket messages: 20 a second per connection; larger bursts close the socket.

## The database

The database is **SQLite** through `better-sqlite3`, set up as follows:
- **WAL journal, foreign keys on.** Every change is durable when the call returns. Multi-step changes (a rated result, a season rollover, a clan war archive) are single transactions.
- **A tracked schema version.** Version 2 since 6.16 adds replay data and saved games in progress. Older databases are upgraded in place on start, and a database written by a newer server is refused rather than damaged.
- **Constraints.** One account per email and per Google id, one clan per tag, and one clan per player.

### Upgrading from 6.14 (the JSON file)

On first start with an empty database, the server imports `LEGACY_DATA_FILE`. Everything comes across:
- users and ratings;
- sessions, so nobody is signed out;
- magic links and cloud saves;
- rated games;
- seasons with their history;
- the tournament;
- clans and the clan war.

The old file is then renamed to `db.json.imported`, so it is never imported twice. An old `DATA_FILE=…/db.json` setting still works: the database is created next to it as `db.db`.

To import by hand:

```bash
npm run db -- import server-data/db.json    # from source
node dist-server/cli.mjs import /data/db.json   # in the image
```

### Backups

- **Automatic.** In production a consistent copy is taken every `BACKUP_HOURS` (the first a minute after start), using SQLite's online backup, which is safe while players are playing. The newest `BACKUP_KEEP` are kept.
- **By hand:**

  ```bash
  npm run db -- backup                 # into the backup folder
  npm run db -- backup /somewhere/chess.db
  npm run db -- stats                  # how much is stored
  ```
- **Restoring.** Stop the server, copy a backup over `chess.db` (delete `chess.db-wal` and `chess.db-shm`), and start again.

## Health and scaling

- **Players' data.** Players can download everything stored about them (`GET /api/me/export`) and delete their account (`DELETE /api/me`, from the Online screen).
- **Health check.** `GET /api/health` answers `200` with the version, the uptime, the database status, and live counts: people online, games, queues, Card Chess and Battle Royale rooms. It answers `503` if the database stops answering.
- **One process.** Games, queues and clocks live in memory. SQLite handles thousands of rated games a minute on one machine.
- **Restarts and deploys.** Games in progress survive a restart.
  - Each one is saved after every move and comes back when the server starts again.
  - The clock to move stays stopped until that player reconnects.
  - Anyone not back within 2 minutes loses; if neither player returns, the game is aborted.
  - The Weekly Knockout gives players 3 minutes to reconnect before anyone forfeits.
  - So a deploy (stop, then start the new version) costs players a few seconds of reconnecting, not their games.
- **Shutting down.** On `SIGTERM` the server stops taking connections, closes the sockets and checkpoints the database. After 10 seconds it exits regardless.
- **Restarting itself.** Docker's `restart: unless-stopped` and systemd's `Restart=always` start a new process when the old one exits, and three things make it exit on purpose:
  - **A dead database.** A watchdog checks the database every 30 seconds; after 3 failed checks in a row the process exits with an error.
  - **Uncaught bugs.** An exception or a rejected promise that nothing handled is logged, the server shuts down cleanly, and it exits with an error.
  - **Saved games.** Open games are saved on every move, so they come back after the restart.
- **Docker health.** The image's `HEALTHCHECK` (and the one in `deploy/docker-compose.yml`) polls `/api/health`, and Caddy only starts once the game server reports healthy.
- **Crash reports from browsers.** When a player's app hits an error, a short report reaches the server log as `client-error [where] message @ page vVERSION | browser`, followed by the stack trace.
  - It covers errors caught by an error boundary and errors nothing else handled.
  - It holds no personal data and is limited to a few reports per session and per address.
  - Failed downloads are left out, as they recover on their own.

## The app without the server

`npm run build` alone produces a static `dist/` that works on any static host. Everything offline works there. Online ranked play, accounts and cloud saves need the server, and the Online screen says so.

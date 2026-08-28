# Wrexlyn for Investments — License Server

Registration, license-check, and admin dashboard backend for Wrexlyn for
Investments installs. This is **not deployed by default** — the main app runs
with no licensing gate at all until you deploy this and point it at the
result (see the main [README.md](../README.md)'s "Commercial licensing"
section). Every registered copy of Wrexlyn for Investments registers here
once (name + email) and checks in on every startup (and periodically while
running) to confirm it's still allowed to run. The admin dashboard at
`/admin` lists every registered install with usage/retention metrics, and
lets you revoke or restore access per user — this is the actual
license-enforcement mechanism: revoke a non-paying customer's device here and
their next check-in hard-blocks.

## Local development

1. Create a free Postgres database — [Neon](https://neon.tech) or
   [Supabase](https://supabase.com) both have a free tier, and either persists
   independently of wherever this app itself runs (important: most cheap/free
   app hosts wipe their filesystem on redeploy, which would otherwise silently
   delete every registered user if the database lived on the same host).
   Copy its connection string.
2. `cp .env.example .env` and fill in `DATABASE_URL` (from step 1) and
   `ADMIN_PASSWORD` (pick something long and unique — this is the only
   credential protecting `/admin`).
3. `npm install`
4. `npm run dev` — starts on `http://localhost:8788` by default (`PORT` in
   `.env` to change it). The database schema is created automatically on
   first boot if it doesn't already exist.
5. Visit `http://localhost:8788/admin` and sign in with `ADMIN_PASSWORD`.

## Deploying

This is a plain Node/Express app with no host-specific code — deploy it
anywhere that runs a long-lived Node process (Render, Fly.io, Railway, a
plain VPS, etc.). The only two things that matter:

- Set the same two environment variables (`DATABASE_URL`, `ADMIN_PASSWORD`)
  on whatever host you choose.
- Build with `npm run build`, run with `npm start`.

A ready-to-use [`render.yaml`](../render.yaml) Blueprint is at the
wrexlyn-investments repo root — connect the repo to a Render account and
"New > Blueprint" picks it up, prompting for the two secrets above.

Once deployed, turn licensing on in the main app by setting
`WREXLYN_INVESTMENTS_LICENSE_SERVER_URL` (see `server/licensing.ts` in the
main repo) to this service's public URL. Until that env var is set, the main
app runs exactly as it does today, unlicensed.

## API

- `POST /api/register` `{ deviceId, name, email }` → `{ token }` — called
  once by a fresh install. Re-registering the same `deviceId` rotates the
  token (the old one stops working) and updates the stored name/email.
- `POST /api/checkin` with `Authorization: Bearer <token>` → `{ allowed: true
  | false }` — called on every startup and periodically while it keeps
  running. Also records the usage datapoint the admin dashboard's metrics are
  built from — there's no separate telemetry-only endpoint.
- `GET /api/version` with the same bearer auth → `{ release: { commitSha,
  downloadUrl, notes? } | null }` — not called by anything in
  wrexlyn-investments today (no auto-update client), kept for parity with the
  ported design and available if one is added later.

## Data retention

`users` rows (name, email, device id, timestamps) are kept until you delete
them directly in the database — there's no automatic expiry, since the admin
dashboard needs this data to be meaningful. `usage_events` rows (one per
check-in) should be pruned periodically (e.g. anything older than 12 months)
if the table grows large enough to matter; there's no built-in job for this
yet, run a `DELETE FROM usage_events WHERE created_at < now() - interval '12 months'`
on whatever schedule you're comfortable with.

Before commercial deployment, implement and monitor the documented retention schedule, publish
the main repository's `PRIVACY_POLICY.md`, configure a private data-rights contact channel, restrict
the admin dashboard by network and strong authentication where practical, rotate secrets, enable host
and database backups, and establish an incident-response process. This README describes operation;
it is not a substitute for a data-processing agreement or jurisdiction-specific compliance review.

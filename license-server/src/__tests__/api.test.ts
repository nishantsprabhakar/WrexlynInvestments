import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../server";
import { createTestDb } from "./testDb";

const ADMIN_PASSWORD = "test-admin-password";

test("POST /api/register: rejects missing/invalid fields", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const missingEmail = await request(app).post("/api/register").send({ deviceId: "d1", name: "Ada" });
  assert.equal(missingEmail.status, 400);

  const badEmail = await request(app).post("/api/register").send({ deviceId: "d1", name: "Ada", email: "not-an-email" });
  assert.equal(badEmail.status, 400);

  const noDeviceId = await request(app).post("/api/register").send({ name: "Ada", email: "a@example.com" });
  assert.equal(noDeviceId.status, 400);
});

test("OPTIONS /api/register: answers the CORS preflight without touching the database", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).options("/api/register");
  assert.equal(res.status, 204);
  assert.match(res.headers["access-control-allow-methods"], /POST/);
});

test("POST /api/register: creates a user and returns a token", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).post("/api/register").send({ deviceId: "d1", name: "Ada Lovelace", email: "ada@example.com" });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.token === "string" && res.body.token.length >= 48);
});

test("POST /api/register: re-registering the same deviceId rotates the token and updates name/email", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const first = await request(app).post("/api/register").send({ deviceId: "d1", name: "Ada", email: "ada@example.com" });
  const second = await request(app)
    .post("/api/register")
    .send({ deviceId: "d1", name: "Ada Lovelace", email: "ada.lovelace@example.com" });

  assert.notEqual(first.body.token, second.body.token);

  // the OLD token must no longer work after rotation
  const checkinOld = await request(app).post("/api/checkin").set("Authorization", `Bearer ${first.body.token}`);
  assert.equal(checkinOld.status, 401);

  const checkinNew = await request(app).post("/api/checkin").set("Authorization", `Bearer ${second.body.token}`);
  assert.equal(checkinNew.status, 200);
  assert.equal(checkinNew.body.allowed, true);
});

test("POST /api/checkin: unknown token is rejected", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).post("/api/checkin").set("Authorization", "Bearer not-a-real-token");
  assert.equal(res.status, 401);
});

test("POST /api/checkin: missing Authorization header is rejected", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).post("/api/checkin");
  assert.equal(res.status, 401);
});

test("POST /api/checkin: allowed:true for an active user, records last_seen and a usage_event", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "d2", name: "Grace Hopper", email: "grace@example.com" });

  const res = await request(app).post("/api/checkin").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.allowed, true);

  const events = await db.query("SELECT * FROM usage_events");
  assert.equal(events.rows.length, 1);
  const user = await db.query<{ last_seen_at: string | null }>("SELECT last_seen_at FROM users WHERE device_id = $1", ["d2"]);
  assert.ok(user.rows[0].last_seen_at);
});

test("POST /api/register: rate-limited after 10 requests/hour from the same IP", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  let lastStatus = 0;
  for (let i = 0; i < 11; i++) {
    const res = await request(app)
      .post("/api/register")
      .send({ deviceId: `rl-${i}`, name: "Spammer", email: `spam${i}@example.com` });
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429);
});

test("GET /api/version: missing or unknown token is rejected", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const noAuth = await request(app).get("/api/version");
  assert.equal(noAuth.status, 401);

  const badToken = await request(app).get("/api/version").set("Authorization", "Bearer not-a-real-token");
  assert.equal(badToken.status, 401);
});

test("GET /api/version: returns release:null when the admin hasn't published one yet", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "v1", name: "Ada", email: "ada@example.com" });

  const res = await request(app).get("/api/version").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.release, null);
});

test("GET /api/version: returns the published release for a registered, active device", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "v2", name: "Grace", email: "grace@example.com" });
  await db.query(
    `INSERT INTO app_config (key, value) VALUES ('latest_release', $1)`,
    [JSON.stringify({ commitSha: "abc123", downloadUrl: "https://example.com/Wrexlyn-Investments-Setup.exe", notes: "hotfix" })]
  );

  const res = await request(app).get("/api/version").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.release, {
    commitSha: "abc123",
    downloadUrl: "https://example.com/Wrexlyn-Investments-Setup.exe",
    notes: "hotfix",
  });
});

test("GET /api/version: a revoked device is forbidden, not just told there's no release", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "v3", name: "Alan", email: "alan@example.com" });
  await db.query("UPDATE users SET status = 'revoked' WHERE device_id = $1", ["v3"]);

  const res = await request(app).get("/api/version").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(res.status, 403);
});

test("POST /api/checkin: allowed:false for a revoked user, no usage_event recorded", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "d3", name: "Alan Turing", email: "alan@example.com" });
  await db.query("UPDATE users SET status = 'revoked' WHERE device_id = $1", ["d3"]);

  const res = await request(app).post("/api/checkin").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.allowed, false);

  const events = await db.query("SELECT * FROM usage_events");
  assert.equal(events.rows.length, 0);
});

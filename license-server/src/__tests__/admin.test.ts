import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../server";
import { createTestDb } from "./testDb";
import { _resetSessionsForTesting } from "../adminAuth";

const ADMIN_PASSWORD = "test-admin-password";

test.beforeEach(() => {
  _resetSessionsForTesting();
});

async function loginAgent(app: ReturnType<typeof buildApp>) {
  const agent = request.agent(app);
  const res = await agent.post("/admin/login").send({ password: ADMIN_PASSWORD });
  assert.equal(res.status, 302);
  return agent;
}

test("GET /admin: redirects to login without a session", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).get("/admin");
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /\/admin\/login/);
});

test("POST /admin/login: wrong password is rejected, correct password creates a session", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const wrong = await request(app).post("/admin/login").send({ password: "nope" });
  assert.equal(wrong.status, 401);

  const agent = await loginAgent(app);
  const dashboard = await agent.get("/admin");
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /Wrexlyn for Investments Admin/);
});

test("POST /admin/login: repeated failed passwords are rate-limited", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await request(app).post("/admin/login").send({ password: "wrong" });
    assert.equal(res.status, 401);
  }

  const blocked = await request(app).post("/admin/login").send({ password: "wrong" });
  assert.equal(blocked.status, 429);
  assert.match(blocked.text, /too many/i);
});

test("Admin responses include browser security and no-store headers", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const res = await request(app).get("/admin/login");
  assert.match(res.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(res.headers["permissions-policy"], /camera=\(\)/);
  assert.equal(res.headers["cache-control"], "no-store");
});

test("Admin dashboard escapes a malicious user name (stored-XSS regression)", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  await request(app)
    .post("/api/register")
    .send({ deviceId: "xss1", name: "<script>alert(1)</script>", email: "xss@example.com" });

  const agent = await loginAgent(app);
  const dashboard = await agent.get("/admin");
  assert.equal(dashboard.status, 200);
  assert.ok(!dashboard.text.includes("<script>alert(1)</script>"));
  assert.ok(dashboard.text.includes("&lt;script&gt;"));
});

test("Revoke then restore round-trip actually changes checkin behavior", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "d9", name: "Margaret Hamilton", email: "peggy@example.com" });
  const userRow = await db.query<{ id: number }>("SELECT id FROM users WHERE device_id = $1", ["d9"]);
  const userId = userRow.rows[0].id;

  const agent = await loginAgent(app);
  const revoke = await agent.post(`/admin/users/${userId}/revoke`).send({ reason: "test revoke" });
  assert.equal(revoke.status, 302);

  const blocked = await request(app).post("/api/checkin").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(blocked.body.allowed, false);

  const restore = await agent.post(`/admin/users/${userId}/restore`);
  assert.equal(restore.status, 302);

  const allowed = await request(app).post("/api/checkin").set("Authorization", `Bearer ${reg.body.token}`);
  assert.equal(allowed.body.allowed, true);
});

test("GET /admin/users.csv: requires a session and returns escaped CSV", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  await request(app).post("/api/register").send({ deviceId: "csv1", name: 'Say "Hi"', email: "csv@example.com" });

  const noSession = await request(app).get("/admin/users.csv");
  assert.equal(noSession.status, 302);

  const agent = await loginAgent(app);
  const res = await agent.get("/admin/users.csv");
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/csv/);
  assert.ok(res.text.includes('"Say ""Hi"""'));
});

test("POST /admin/release: requires a session, publishes a release the API then serves", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  const reg = await request(app).post("/api/register").send({ deviceId: "r1", name: "Hedy", email: "hedy@example.com" });

  const noSession = await request(app).post("/admin/release").send({ commitSha: "deadbeef", downloadUrl: "https://example.com/x.exe" });
  assert.equal(noSession.status, 302);
  assert.match(noSession.headers.location, /\/admin\/login/);

  const agent = await loginAgent(app);
  const publish = await agent.post("/admin/release").send({ commitSha: "deadbeef", downloadUrl: "https://example.com/x.exe", notes: "v2" });
  assert.equal(publish.status, 302);

  const version = await request(app).get("/api/version").set("Authorization", `Bearer ${reg.body.token}`);
  assert.deepEqual(version.body.release, { commitSha: "deadbeef", downloadUrl: "https://example.com/x.exe", notes: "v2" });

  const dashboard = await agent.get("/admin");
  assert.match(dashboard.text, /deadbeef/);
});

test("POST /admin/release: rejects a missing commitSha or downloadUrl", async () => {
  const app = buildApp(await createTestDb(), ADMIN_PASSWORD);
  const agent = await loginAgent(app);
  const res = await agent.post("/admin/release").send({ commitSha: "onlysha" });
  assert.equal(res.status, 400);
});

test("GET /admin?q=: search filters by name/email substring", async () => {
  const db = await createTestDb();
  const app = buildApp(db, ADMIN_PASSWORD);
  await request(app).post("/api/register").send({ deviceId: "s1", name: "Katherine Johnson", email: "katherine@example.com" });
  await request(app).post("/api/register").send({ deviceId: "s2", name: "Dorothy Vaughan", email: "dorothy@example.com" });

  const agent = await loginAgent(app);
  const res = await agent.get("/admin?q=Katherine");
  assert.ok(res.text.includes("Katherine Johnson"));
  assert.ok(!res.text.includes("Dorothy Vaughan"));
});

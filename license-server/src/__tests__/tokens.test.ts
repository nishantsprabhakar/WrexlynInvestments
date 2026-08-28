import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, hashToken, escapeHtml } from "../tokens";

test("generateToken: produces a sufficiently long, unique token per call", () => {
  const a = generateToken();
  const b = generateToken();
  assert.ok(a.length >= 48);
  assert.notEqual(a, b);
});

test("hashToken: deterministic for the same input, different for different input", () => {
  const token = generateToken();
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), hashToken(generateToken()));
});

test("escapeHtml: neutralizes a script tag (stored-XSS regression)", () => {
  const malicious = "<script>alert(1)</script>";
  const escaped = escapeHtml(malicious);
  assert.ok(!escaped.includes("<script>"));
  assert.equal(escaped, "&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("escapeHtml: escapes quotes and ampersands used to break out of attributes", () => {
  assert.equal(escapeHtml(`"><img src=x onerror=alert(1)>`), "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
});

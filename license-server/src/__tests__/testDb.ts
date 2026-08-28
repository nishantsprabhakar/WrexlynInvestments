/**
 * Test-only helper — an in-memory Postgres-compatible database (pg-mem) that
 * implements the same `Db.query()` surface as the real `pg.Pool`, running the
 * exact same schema.sql and SQL statements the real routes use. Not itself a
 * *.test.ts file, so scripts/run-tests.js's *.test.js filter skips it.
 */
import { newDb, DataType } from "pg-mem";
import type { Db } from "../db";
import { initSchema } from "../db";

/** Zero-pads to 2 digits, e.g. for month/day in a YYYY-MM-DD string. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export async function createTestDb(): Promise<Db> {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem implements very few native SQL functions — real Postgres (and the hosted Neon/Supabase
  // instance this runs against in production) supports to_char natively, but the test double needs
  // it taught explicitly. Only the 'YYYY-MM-DD' pattern this codebase actually uses is implemented;
  // this is a test fixture, not a general to_char reimplementation.
  mem.public.registerFunction({
    name: "to_char",
    args: [DataType.timestamptz, DataType.text],
    returns: DataType.text,
    implementation: (value: Date) => `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`,
  });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db: Db = { query: (sql, params) => pool.query(sql, params) };
  await initSchema(db);
  return db;
}

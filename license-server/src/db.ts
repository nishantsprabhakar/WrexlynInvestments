/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * Thin Postgres access layer. Routes depend on the `Db` interface, not on
 * `pg.Pool` directly, so tests can substitute an in-memory Postgres-compatible
 * engine (pg-mem) that implements the same `query()` surface and runs the exact
 * same schema.sql and SQL statements the real routes use — not a hand-rolled
 * fake that only approximates the real queries.
 */
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

export interface QueryResult<T = any> {
  rows: T[];
}

export interface Db {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

export function createPgDb(connectionString: string): Db {
  const pool = new Pool({ connectionString });
  return {
    query: async <T = any>(sql: string, params?: any[]) => {
      const result = await pool.query<any>(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}

export async function initSchema(db: Db): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  // Statement-split on ";\n" rather than sending the whole file as one query — pg-mem
  // (used in tests) doesn't support Postgres's implicit multi-statement mode the way a
  // real server connection does, so each statement is executed as its own query. Real
  // and test code paths run through the exact same loop, not two different schema-init
  // mechanisms.
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.query(statement);
  }
}

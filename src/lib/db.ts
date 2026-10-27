// The database connection.
//
// In production (Vercel) set DATABASE_URL to a Postgres database, for example
// one from Neon. Without DATABASE_URL the app uses PGlite, a full Postgres that
// runs inside Node and keeps its files in ./.data, so you can try everything on
// your own computer without installing a database.
//
// The rest of the app only uses `query`, `one` and `transaction` from here.

import { MIGRATIONS } from "./schema";

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface Driver extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

async function createPostgresDriver(url: string): Promise<Driver> {
  const { Pool, types } = await import("pg");
  // Keep DATE columns as plain "YYYY-MM-DD" text instead of JS Date objects.
  types.setTypeParser(1082, (v: string) => v);
  // Return NUMERIC (prices) and BIGINT (sums) as numbers.
  types.setTypeParser(1700, (v: string) => Number(v));
  types.setTypeParser(20, (v: string) => Number(v));
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return res.rows as T[];
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          async query<T>(sql: string, params: unknown[] = []) {
            const res = await client.query(sql, params);
            return res.rows as T[];
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function createPgliteDriver(dataDir: string | undefined): Promise<Driver> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  // Same conversions as the Postgres driver above.
  const options = {
    parsers: {
      [types.DATE]: (v: string) => v,
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
    },
  };
  // PGlite handles one statement at a time, so queue everything to keep
  // transactions from overlapping.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  }
  return {
    query<T>(sql: string, params: unknown[] = []) {
      return serial(async () => (await pg.query<T>(sql, params, options)).rows);
    },
    transaction(fn) {
      return serial(() =>
        pg.transaction((tx) =>
          fn({
            async query<T>(sql: string, params: unknown[] = []) {
              return (await tx.query<T>(sql, params, options)).rows;
            },
          }),
        ),
      );
    },
  };
}

async function migrate(db: Driver) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const done = await db.query<{ version: number }>("SELECT version FROM schema_migrations");
  const applied = new Set(done.map((r) => r.version));
  for (const [index, sql] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (applied.has(version)) continue;
    await db.transaction(async (tx) => {
      for (const statement of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
        await tx.query(statement);
      }
      await tx.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    });
  }
}

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) to this Vercel project.");
  }
  const driver = url
    ? await createPostgresDriver(url)
    : await createPgliteDriver(process.env.PGLITE_DIR ?? (process.env.NODE_ENV === "test" ? undefined : "./.data/pglite"));
  await migrate(driver);
  return driver;
}

// Keep one connection for the whole server process (and across hot reloads
// while developing).
const globalForDb = globalThis as unknown as { __sortmedDb?: Promise<Driver> };

function getDb(): Promise<Driver> {
  if (!globalForDb.__sortmedDb) {
    globalForDb.__sortmedDb = connect().catch((err) => {
      globalForDb.__sortmedDb = undefined;
      throw err;
    });
  }
  return globalForDb.__sortmedDb;
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(sql, params))[0];
}

export async function transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

export function newId(): string {
  return crypto.randomUUID();
}

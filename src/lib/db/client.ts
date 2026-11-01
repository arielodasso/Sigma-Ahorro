import "server-only";
import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import postgres from "postgres";
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from "./schema";
import { seedCurrencies } from "./seed";

export type Dialect = "sqlite" | "postgres";

export interface RunResult {
  changes: number;
}

export interface Database {
  dialect: Dialect;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function normalizeParams(params: unknown[] = []): unknown[] {
  return params.map((value) => (value === undefined ? null : value));
}

function normalizeValue(key: string, value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^-?\d+$/.test(value) && value.length <= 16) {
    if (/(minor|scaled|count|size|decimals|active|archived|is_system|excluded|auto_post|biometric_enabled|installments|interval_count|hit_count|percentage|amount)/i.test(key)) {
      return Number(value);
    }
  }
  return value;
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = normalizeValue(key, value);
  }
  return result as T;
}

function createSqliteDatabase(filePath: string): Database {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new BetterSqlite3(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SQLITE_SCHEMA);

  let transactionQueue: Promise<unknown> = Promise.resolve();

  const api: Database = {
    dialect: "sqlite",
    async all<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...normalizeParams(params)) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).get(...normalizeParams(params)) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      const info = sqlite.prepare(sql).run(...normalizeParams(params));
      return { changes: info.changes };
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
      const execute = async () => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn(api);
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          try {
            sqlite.exec("ROLLBACK");
          } catch {
            // La transacción ya pudo haber sido revertida por SQLite.
          }
          throw error;
        }
      };
      const next = transactionQueue.then(execute, execute);
      transactionQueue = next.then(
        () => undefined,
        () => undefined,
      );
      return next as Promise<T>;
    },
    async close() {
      sqlite.close();
    },
  };

  return api;
}

function translatePlaceholders(query: string): string {
  let index = 0;
  return query.replace(/\?/g, () => `$${(index += 1)}`);
}

type PgClient = {
  unsafe(query: string, params?: unknown[]): Promise<unknown>;
};

function createPostgresDatabase(client: PgClient): Database {
  const api: Database = {
    dialect: "postgres",
    async all<T>(sql: string, params: unknown[] = []) {
      const rows = (await client.unsafe(translatePlaceholders(sql), normalizeParams(params))) as Record<string, unknown>[];
      return rows.map((row) => normalizeRow<T>(row));
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const rows = (await client.unsafe(translatePlaceholders(sql), normalizeParams(params))) as Record<string, unknown>[];
      return rows[0] ? normalizeRow<T>(rows[0]) : undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      const result = (await client.unsafe(translatePlaceholders(sql), normalizeParams(params))) as unknown as {
        count?: number;
      };
      return { changes: result.count ?? 0 };
    },
    async exec(sql: string) {
      await client.unsafe(sql);
    },
    transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
      throw new Error("La transacción debe iniciarse desde la conexión principal de PostgreSQL");
    },
    async close() {
      // El pool se cierra desde el módulo index.
    },
  };
  return api;
}

export interface DatabaseBundle {
  db: Database;
  close: () => Promise<void>;
}

export async function createDatabase(): Promise<DatabaseBundle> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl && !databaseUrl.startsWith("sqlite:")) {
    const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);
    const sql = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: isLocal ? false : "require",
      onnotice: () => undefined,
    });
    for (const statement of POSTGRES_SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
      await sql.unsafe(statement);
    }
    const base = createPostgresDatabase(sql as unknown as PgClient);
    const db: Database = {
      ...base,
      transaction<T>(fn: (inner: Database) => Promise<T>): Promise<T> {
        return sql.begin(async (tx) => {
          const txDb = createPostgresDatabase(tx as unknown as PgClient);
          return fn(txDb);
        }) as unknown as Promise<T>;
      },
      async close() {
        await sql.end({ timeout: 5 });
      },
    };
    await seedCurrencies(db);
    return { db, close: () => db.close() };
  }

  const filePath = process.env.SQLITE_PATH?.trim() || path.join(process.env.TMPDIR || "/tmp", "sigma-ahorro.db");
  const db = createSqliteDatabase(filePath);
  await seedCurrencies(db);
  return { db, close: () => db.close() };
}

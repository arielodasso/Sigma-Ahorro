import "server-only";
import { createDatabase, type Database, type DatabaseBundle } from "./client";

const globalForDb = globalThis as unknown as { __sigmaDbBundle?: Promise<DatabaseBundle> };

export function getDbBundle(): Promise<DatabaseBundle> {
  if (!globalForDb.__sigmaDbBundle) {
    globalForDb.__sigmaDbBundle = createDatabase().catch((error) => {
      globalForDb.__sigmaDbBundle = undefined;
      throw error;
    });
  }
  return globalForDb.__sigmaDbBundle;
}

export async function getDb(): Promise<Database> {
  const bundle = await getDbBundle();
  return bundle.db;
}

export type { Database } from "./client";

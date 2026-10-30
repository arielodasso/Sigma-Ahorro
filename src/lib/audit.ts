import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export async function logAudit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      "INSERT INTO audit_logs (id, user_id, action, entity, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        randomUUID(),
        userId,
        action,
        entity,
        entityId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    console.error("audit_log_failed", error instanceof Error ? error.message : "unknown");
  }
}

import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { detectCategoryFromText } from "@/lib/parser";
import type { Category } from "@/types";

export async function listCategories(userId: string, kind?: "expense" | "income"): Promise<Category[]> {
  const db = await getDb();
  if (kind) {
    return db.all<Category>(
      "SELECT * FROM categories WHERE user_id = ? AND kind = ? AND archived = 0 ORDER BY sort_order, name",
      [userId, kind],
    );
  }
  return db.all<Category>(
    "SELECT * FROM categories WHERE user_id = ? AND archived = 0 ORDER BY kind, sort_order, name",
    [userId],
  );
}

export async function getCategory(userId: string, categoryId: string): Promise<Category | null> {
  const db = await getDb();
  return (await db.get<Category>("SELECT * FROM categories WHERE id = ? AND user_id = ?", [categoryId, userId])) ?? null;
}

export async function findCategoryByName(userId: string, name: string): Promise<Category | null> {
  const db = await getDb();
  return (
    (await db.get<Category>("SELECT * FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?) LIMIT 1", [
      userId,
      name.trim(),
    ])) ?? null
  );
}

export interface CategoryInput {
  name: string;
  kind: "expense" | "income";
  parentId?: string | null;
  color?: string;
  icon?: string;
}

export async function createCategory(userId: string, input: CategoryInput): Promise<Category> {
  const db = await getDb();
  const now = new Date().toISOString();
  const max = await db.get<{ max_order: number | null }>(
    "SELECT MAX(sort_order) AS max_order FROM categories WHERE user_id = ?",
    [userId],
  );
  const category: Category = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    kind: input.kind,
    parent_id: input.parentId ?? null,
    color: input.color ?? "#0E7C66",
    icon: input.icon ?? "Circle",
    sort_order: Number(max?.max_order ?? 0) + 10,
    archived: 0,
    is_system: 0,
    created_at: now,
  };
  await db.run(
    "INSERT INTO categories (id, user_id, name, kind, parent_id, color, icon, sort_order, archived, is_system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)",
    [
      category.id,
      category.user_id,
      category.name,
      category.kind,
      category.parent_id,
      category.color,
      category.icon,
      category.sort_order,
      category.created_at,
    ],
  );
  return category;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: Partial<CategoryInput> & { archived?: boolean },
): Promise<void> {
  const db = await getDb();
  const current = await getCategory(userId, categoryId);
  if (!current) throw new Error("Categoría no encontrada");
  await db.run(
    "UPDATE categories SET name = ?, kind = ?, parent_id = ?, color = ?, icon = ?, archived = ? WHERE id = ? AND user_id = ?",
    [
      input.name?.trim() || current.name,
      input.kind ?? current.kind,
      input.parentId === undefined ? current.parent_id : input.parentId,
      input.color ?? current.color,
      input.icon ?? current.icon,
      input.archived === undefined ? current.archived : input.archived ? 1 : 0,
      categoryId,
      userId,
    ],
  );
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const db = await getDb();
  const category = await getCategory(userId, categoryId);
  if (!category) throw new Error("Categoría no encontrada");
  if (category.is_system) {
    await db.run("UPDATE categories SET archived = 1 WHERE id = ? AND user_id = ?", [categoryId, userId]);
    return;
  }
  const used = await db.get<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM transactions WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL",
    [categoryId, userId],
  );
  if (Number(used?.count ?? 0) > 0) {
    await db.run("UPDATE categories SET archived = 1 WHERE id = ? AND user_id = ?", [categoryId, userId]);
    return;
  }
  await db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [categoryId, userId]);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function suggestCategoryId(
  userId: string,
  description: string,
  merchant?: string | null,
): Promise<string | null> {
  const db = await getDb();
  const haystack = normalize(`${description} ${merchant ?? ""}`);
  const rules = await db.all<{ pattern: string; category_id: string }>(
    "SELECT pattern, category_id FROM classification_rules WHERE user_id = ? ORDER BY priority DESC, hit_count DESC",
    [userId],
  );
  for (const rule of rules) {
    if (haystack.includes(normalize(rule.pattern))) {
      await db.run("UPDATE classification_rules SET hit_count = hit_count + 1 WHERE user_id = ? AND pattern = ?", [
        userId,
        rule.pattern,
      ]);
      return rule.category_id;
    }
  }
  const categoryName = detectCategoryFromText(`${description} ${merchant ?? ""}`);
  if (!categoryName) return null;
  const category = await findCategoryByName(userId, categoryName);
  return category?.id ?? null;
}

export async function learnClassification(
  userId: string,
  description: string,
  merchant: string | null | undefined,
  categoryId: string,
): Promise<void> {
  const pattern = normalize(merchant || description).slice(0, 80);
  if (pattern.length < 2) return;
  const db = await getDb();
  await db.run(
    `INSERT INTO classification_rules (id, user_id, pattern, category_id, priority, hit_count, created_at)
     VALUES (?, ?, ?, ?, 10, 1, ?)
     ON CONFLICT (user_id, pattern) DO UPDATE SET category_id = excluded.category_id, priority = excluded.priority`,
    [randomUUID(), userId, pattern, categoryId, new Date().toISOString()],
  );
}

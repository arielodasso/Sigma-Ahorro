import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import type { User } from "@/types";

const COOKIE_NAME = "sigma_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 24) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET no está configurado. Definí una clave de al menos 24 caracteres.");
  }
  return new TextEncoder().encode("sigma-ahorro-dev-secret-no-usar-en-produccion");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: Pick<User, "id" | "email">): Promise<void> {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = await getDb();
  const user = await db.get<User>("SELECT * FROM users WHERE id = ?", [userId]);
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  return Number(row?.count ?? 0) > 0;
}

export async function userCount(): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  return Number(row?.count ?? 0);
}

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt) return { allowed: true, retryAfterSeconds: 0 };
  if (attempt.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((attempt.blockedUntil - now) / 1000) };
  }
  if (now - attempt.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function registerLoginFailure(key: string): void {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt || now - attempt.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  attempt.count += 1;
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_MS;
  }
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

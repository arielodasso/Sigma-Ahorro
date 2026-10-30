import { createHash } from "node:crypto";
import { normalizeForMatch } from "./parser";

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function transactionFingerprint(input: {
  date: string;
  amountMinor: number;
  currency: string;
  merchant?: string | null;
  description?: string | null;
}): string {
  const merchant = normalizeForMatch(input.merchant ?? "");
  const description = normalizeForMatch(input.description ?? "");
  return sha256(`${input.date}|${input.amountMinor}|${input.currency}|${merchant}|${description}`);
}

export function imageFingerprint(buffer: Buffer): string {
  return sha256(buffer);
}

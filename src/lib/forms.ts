export function formString(formData: FormData, key: string, fallback = ""): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

export function formOptionalString(formData: FormData, key: string): string | null {
  const value = formString(formData, key);
  return value.length > 0 ? value : null;
}

export function formNumber(formData: FormData, key: string, fallback = 0): number {
  const value = formString(formData, key);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

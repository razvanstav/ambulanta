import type { Identity } from "@/modules/identity/policy";

export const categories = {
  medication: "Medicamente",
  consumable: "Consumabile",
  accessory: "Accesorii",
} as const;
export const units = {
  buc: "bucată",
  fiola: "fiolă",
  comprimat: "comprimat",
  pereche: "pereche",
  ml: "mililitru",
  l: "litru",
  m: "metru",
} as const;
export type Category = keyof typeof categories;
export type Unit = keyof typeof units;
export const isIndivisible = (unit: string) =>
  ["buc", "fiola", "comprimat", "pereche"].includes(unit);
export const canManageCatalog = (identity: Pick<Identity, "roles">) =>
  identity.roles.some(
    (r) => r.substation_id === null && ["administrator", "logistics"].includes(r.role),
  );

// Preserve exact decimal input all the way to PostgreSQL; never round silently.
export function parseMinimum(value: string, precision: number): string | null {
  const normalized = value.trim().replace(",", ".");
  if (
    !Number.isInteger(precision) ||
    precision < 0 ||
    precision > 3 ||
    !/^\d{1,9}(?:\.\d{1,3})?$/.test(normalized)
  )
    return null;
  const fraction = normalized.split(".")[1] ?? "";
  if (/[1-9]/.test(fraction.slice(precision))) return null;
  return normalized;
}
export function bucharestDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function lotStatus(blocked: boolean, expiresOn: string | null, today = bucharestDate()) {
  if (blocked) return "Blocat";
  if (expiresOn && expiresOn < today) return "Expirat";
  return "Valid";
}
export function validExpiry(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

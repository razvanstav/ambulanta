import type { SheetLine } from "@/modules/shifts";

export function groupProductLines(lines: SheetLine[]): SheetLine[] {
  const groups = new Map<string, SheetLine>();
  for (const line of lines) {
    const prior = groups.get(line.product_id);
    if (prior)
      prior.quantity =
        (Math.round(Number(prior.quantity) * 1000) + Math.round(Number(line.quantity) * 1000)) /
        1000;
    else
      groups.set(line.product_id, {
        ...line,
        id: line.product_id,
        quantity: Number(line.quantity),
      });
  }
  return [...groups.values()];
}

// Convert the product total to immutable allocations, using integer thousandths.
// SQL rechecks the full allocation snapshot and exact unit precision atomically.
export function expandProductConsumption(
  allocations: { id: string; product_id: string; quantity: number }[],
  products: { product_id: string; consumed: string }[],
) {
  const ids = new Set(allocations.map((a) => a.product_id));
  if (
    !ids.size ||
    ids.size !== products.length ||
    new Set(products.map((p) => p.product_id)).size !== products.length ||
    products.some((p) => !ids.has(p.product_id))
  )
    throw new Error("Completează fiecare produs o singură dată.");
  const output: { allocation_id: string; consumed: string; returned: string }[] = [];
  for (const product of products) {
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(product.consumed)) throw new Error("Cantitate nevalidă.");
    let remaining = Math.round(Number(product.consumed) * 1000);
    for (const line of allocations
      .filter((a) => a.product_id === product.product_id)
      .sort((a, b) => a.id.localeCompare(b.id))) {
      const take = Math.min(remaining, Math.round(Number(line.quantity) * 1000));
      output.push({ allocation_id: line.id, consumed: String(take / 1000), returned: "0" });
      remaining -= take;
    }
    if (remaining > 0) throw new Error("Consumul depășește cantitatea preluată.");
  }
  return output.sort((a, b) => a.allocation_id.localeCompare(b.allocation_id));
}
import type { DeclarationLine } from "@/modules/evidence/types";

export function groupDeclarationLines(
  lines: DeclarationLine[],
  allocations: { id: string; product_id: string }[],
) {
  const products = new Map(allocations.map((a) => [a.id, a.product_id]));
  const groups = new Map<string, DeclarationLine>();
  for (const line of lines) {
    const key = products.get(line.allocation_id) ?? line.allocation_id;
    const normalized = {
      ...line,
      remaining:
        line.remaining ??
        (Math.round(Number(line.issued) * 1000) -
          Math.round(Number(line.consumed) * 1000) -
          Math.round(Number(line.returned ?? 0) * 1000)) /
          1000,
    };
    const prior = groups.get(key);
    if (prior)
      for (const field of ["issued", "consumed", "returned", "remaining"] as const)
        prior[field] =
          (Math.round(Number(prior[field] ?? 0) * 1000) +
            Math.round(Number(normalized[field] ?? 0) * 1000)) /
          1000;
    else groups.set(key, normalized);
  }
  return [...groups.values()];
}

import type { CloseoutVersion, DeclarationLine } from "@/modules/evidence/types";

export type ShiftReport = {
  id: string;
  closed_at: string;
  version: number;
  content_hash: string;
  content: CloseoutVersion["content"] & {
    started_at?: string | null;
    planned_end?: string | null;
    operational_date?: string;
    lines: (DeclarationLine & { product_code?: string })[];
  };
};

// Only immutable declaration fields are used, never the current catalogue.
export function reportLines(report: ShiftReport) {
  const groups = new Map<string, DeclarationLine>();
  for (const line of report.content.lines) {
    const key = JSON.stringify([
      line.product_code ?? line.allocation_id,
      line.product_name,
      line.base_unit,
    ]);
    const normalized = {
      ...line,
      remaining:
        line.remaining ??
        (Math.round(Number(line.issued) * 1000) -
          Math.round(Number(line.consumed) * 1000) -
          Math.round(Number(line.returned) * 1000)) /
          1000,
    };
    const prior = groups.get(key);
    if (prior) {
      for (const field of ["issued", "consumed", "returned", "remaining"] as const)
        prior[field] =
          (Math.round(Number(prior[field]) * 1000) + Math.round(Number(normalized[field]) * 1000)) /
          1000;
    } else groups.set(key, normalized);
  }
  return [...groups.values()];
}

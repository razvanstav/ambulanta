import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AggregateReport, ReportFilters } from "./aggregate";

export async function readReports(
  stationId: string,
  filters: ReportFilters,
): Promise<AggregateReport> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("read_reports", {
    p_station: filters.scope === "all" ? null : stationId,
    p_from: filters.from,
    p_until: filters.until,
    p_group: filters.group,
    p_own: filters.own,
    p_holder: filters.holder,
    p_vehicle: filters.vehicle,
    p_shift: filters.shift,
  });
  if (error || !data)
    throw new Error(
      "Rapoartele nu pot fi încărcate. Verifică accesul și disponibilitatea serviciului de raportare.",
    );
  return data as AggregateReport;
}

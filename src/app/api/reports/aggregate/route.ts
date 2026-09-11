import { getIdentity } from "@/modules/identity/server";
import { canUseMyShift, canViewLogistics, isUuid } from "@/modules/identity/policy";
import {
  parseReportFilters,
  reportCsv,
  reportKinds,
  type ReportKind,
} from "@/modules/reports/aggregate";
import { generateAggregatePdf } from "@/modules/reports/aggregate-pdf";
import { readReports } from "@/modules/reports/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const params = new URL(request.url).searchParams;
  const station = params.get("station"),
    kind = params.get("kind") ?? "consumption",
    format = params.get("format") ?? "csv";
  const identity = await getIdentity();
  if (
    !identity ||
    !isUuid(station) ||
    !identity.substations.some((s) => s.id === station && s.active)
  )
    return new Response("Raport inaccesibil.", { status: 404, headers });
  let filters;
  try {
    filters = parseReportFilters(params);
  } catch {
    return new Response("Filtre invalide.", { status: 400, headers });
  }
  if (!Object.hasOwn(reportKinds, kind) || !["csv", "pdf"].includes(format))
    return new Response("Format invalid.", { status: 400, headers });
  if (
    (filters.own ? !canUseMyShift(identity, station) : !canViewLogistics(identity, station)) ||
    (filters.own && ["warehouse", "stock"].includes(kind))
  )
    return new Response("Raport inaccesibil.", { status: 404, headers });
  try {
    const report = await readReports(station, filters);
    const body =
      format === "csv"
        ? reportCsv(report, kind as ReportKind, filters)
        : new Uint8Array(await generateAggregatePdf(report, kind as ReportKind, filters));
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
        "Content-Disposition": `attachment; filename="raport-${kind}-${filters.from}.${format}"`,
      },
    });
  } catch {
    return new Response("Raportul nu poate fi generat. Încearcă din nou.", {
      status: 503,
      headers,
    });
  }
}

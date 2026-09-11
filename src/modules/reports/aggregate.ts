import { isUuid } from "@/modules/identity/policy";

export const groups = {
  day: "Zile",
  week: "Săptămâni (luni)",
  shift: "Ture",
  holder: "Titulari",
  vehicle: "Mașini",
  station: "Substații",
  product: "Produse",
} as const;
export type ReportFilters = {
  from: string;
  until: string;
  group: keyof typeof groups;
  scope: "station" | "all";
  own: boolean;
  holder: string | null;
  vehicle: string | null;
  shift: string | null;
};
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, amount: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}
function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !isNaN(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function parseReportFilters(params: URLSearchParams, now = new Date()): ReportFilters {
  const today = localDay(now);
  const from = params.get("from") ?? today.slice(0, 8) + "01";
  const until = params.get("until") ?? addDays(today, 1);
  const group = params.get("group") ?? "day";
  const scope = params.get("scope") ?? "station";
  const own = params.get("own") ?? "0";
  if (
    !validDay(from) ||
    !validDay(until) ||
    from < "1900-01-01" ||
    until <= from ||
    Date.parse(until) - Date.parse(from) > 366 * 86400000 ||
    !Object.hasOwn(groups, group) ||
    !["station", "all"].includes(scope) ||
    !["0", "1"].includes(own)
  )
    throw new Error(
      "Alege un interval de 1–366 zile și filtre valide. Data «Până la» nu este inclusă.",
    );
  function id(key: string) {
    const value = params.get(key);
    if (!value) return null;
    if (!isUuid(value)) throw new Error("Filtrul de tură, titular sau mașină este invalid.");
    return value;
  }
  return {
    from,
    until,
    group: group as keyof typeof groups,
    scope: scope as ReportFilters["scope"],
    own: own === "1",
    holder: id("holder"),
    vehicle: id("vehicle"),
    shift: id("shift"),
  };
}
export function filterQuery(f: ReportFilters) {
  return new URLSearchParams({
    from: f.from,
    until: f.until,
    group: f.group,
    scope: f.scope,
    own: f.own ? "1" : "0",
    ...(f.holder ? { holder: f.holder } : {}),
    ...(f.vehicle ? { vehicle: f.vehicle } : {}),
    ...(f.shift ? { shift: f.shift } : {}),
  });
}
type ProductRow = {
  substation_id: string;
  station: string;
  product_id: string;
  product: string;
  unit: string;
};
export type AggregateReport = {
  generated_at: string;
  from: string;
  until: string;
  own: boolean;
  group: keyof typeof groups;
  stations: { id: string; name: string }[];
  consumption: (ProductRow & { bucket: string; label: string | null; consumed: string })[];
  warehouse: (ProductRow & {
    opening: string;
    received: string;
    issued: string;
    returned: string;
    closing: string;
  })[];
  stock: (ProductRow & { location_id: string; location: string; kind: string; quantity: string })[];
  closed: {
    id: string;
    station: string;
    holder: string;
    vehicle: string;
    operational_date: string;
    closed_at: string;
    version: number;
    content_hash: string;
  }[];
  pending: {
    id: string;
    station: string;
    holder: string;
    vehicle: string;
    state: string;
    operational_date: string | null;
    planned_end: string | null;
  }[];
  holders: { id: string; name: string }[];
  vehicles: { id: string; name: string }[];
};
export const reportKinds = {
  consumption: "Consum final",
  warehouse: "Mișcări magazie",
  stock: "Stoc curent",
  closed: "Ture închise",
  pending: "Cereri și ture neînchise",
} as const;
export type ReportKind = keyof typeof reportKinds;
export const stateLabels: Record<string, string> = {
  awaiting_issue: "Fără fișă",
  awaiting_acceptance: "Fișă de acceptat",
  open: "Tură pornită",
  pending_close: "În verificare",
};
export const moment = (value: string) =>
  new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function reportTable(report: AggregateReport, kind: ReportKind) {
  switch (kind) {
    case "consumption":
      return {
        headers: ["Substația", "Grupare", "Produs", "Unitate", "Consumat"],
        rows: report.consumption.map((r) => [
          r.station,
          r.label ? `${r.label} (${r.bucket})` : r.bucket,
          r.product,
          r.unit,
          r.consumed,
        ]),
      };
    case "warehouse":
      return {
        headers: [
          "Substația",
          "Produs",
          "Unitate",
          "Sold inițial",
          "Recepții / inițial",
          "Predări",
          "Retururi",
          "Sold final",
        ],
        rows: report.warehouse.map((r) => [
          r.station,
          r.product,
          r.unit,
          r.opening,
          r.received,
          r.issued,
          r.returned,
          r.closing,
        ]),
      };
    case "stock":
      return {
        headers: ["Substația", "Locație", "Produs", "Unitate", "Cantitate"],
        rows: report.stock.map((r) => [r.station, r.location, r.product, r.unit, r.quantity]),
      };
    case "closed":
      return {
        headers: [
          "Substația",
          "Titular",
          "Mașină",
          "Data operațională",
          "Închisă",
          "Tură / versiune",
        ],
        rows: report.closed.map((r) => [
          r.station,
          r.holder,
          r.vehicle,
          r.operational_date,
          moment(r.closed_at),
          `${r.id} / v${r.version}`,
        ]),
      };
    case "pending":
      return {
        headers: [
          "Substația",
          "Titular",
          "Mașină",
          "Stare",
          "Data operațională",
          "Final planificat",
        ],
        rows: report.pending.map((r) => [
          r.station,
          r.holder,
          r.vehicle,
          stateLabels[r.state] ?? r.state,
          r.operational_date ?? "Nepornită",
          r.planned_end ? moment(r.planned_end) : "Nespecificat",
        ]),
      };
  }
}
export function reportNotes(report: AggregateReport, kind: ReportKind, filters: ReportFilters) {
  return [
    `Substații: ${report.stations.map((s) => s.name).join(", ") || "Niciuna"}. ${report.own ? "Numai ture proprii." : "Aria logistică autorizată."}`,
    `Interval: ${report.from} inclus - ${report.until} exclus. Grupare: ${groups[report.group]}.`,
    kind === "stock"
      ? "Stoc curent la generare; nu este sold istoric. Filtrele de perioadă/tură/titular/mașină nu se aplică stocului."
      : kind === "warehouse"
        ? "Magazie: momentul efectiv al înregistrării, Europe/Bucharest. Filtrele de tură/titular/mașină nu se aplică soldurilor. Sold final = inițial + recepții - predări + retururi."
        : kind === "pending"
          ? "Situație curentă, indiferent de interval. Cererile nu sunt ture pornite; consumul nefinalizat nu este raportat ca zero."
          : "Consum și ture închise: data operațională fixată la pornire, inclusiv peste miezul nopții. Denumiri istorice; fără însumarea produselor diferite.",
    ...(["consumption", "closed", "pending"].includes(kind)
      ? [
          `Filtre: titular ${filters.holder ?? "toți"}; mașină ${filters.vehicle ?? "toate"}; tură ${filters.shift ?? "toate"}.`,
        ]
      : []),
    `Generat: ${moment(report.generated_at)} (Europe/Bucharest).`,
  ];
}
export function csvCell(value: string) {
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function reportCsv(report: AggregateReport, kind: ReportKind, filters: ReportFilters) {
  const table = reportTable(report, kind);
  return (
    "\uFEFF" +
    [...reportNotes(report, kind, filters).map((n) => [n]), [], table.headers, ...table.rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}

import Link from "next/link";
import { Button, Panel, StateMessage } from "@/components/ui/primitives";
import { canViewLogistics, type Identity } from "@/modules/identity/policy";
import {
  filterQuery,
  groups,
  moment,
  parseReportFilters,
  reportKinds,
  reportNotes,
  reportTable,
  type ReportFilters,
  type ReportKind,
} from "./aggregate";
import { readReports } from "./server";

export async function ReportsPage({
  stationId,
  identity,
  params,
  own = false,
  dashboard = false,
}: {
  stationId: string;
  identity: Identity;
  params: Record<string, string | string[] | undefined>;
  own?: boolean;
  dashboard?: boolean;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === "string") query.set(key, value);
  query.set("own", own ? "1" : "0");
  let filters: ReportFilters;
  try {
    filters = parseReportFilters(query);
  } catch (error) {
    return (
      <StateMessage kind="error" title="Filtre invalide" description={(error as Error).message}>
        <Link href={`/substatia/${stationId}/${own ? "rapoarte-proprii" : "rapoarte"}`}>
          Resetează filtrele
        </Link>
      </StateMessage>
    );
  }
  const report = await readReports(stationId, filters);
  const kinds: ReportKind[] = dashboard
    ? ["pending"]
    : own
      ? ["consumption", "closed", "pending"]
      : ["consumption", "warehouse", "stock", "closed", "pending"];
  const exportQuery = filterQuery(filters);
  exportQuery.set("station", stationId);
  const started = report.pending.filter((s) => ["open", "pending_close"].includes(s.state)).length;
  const series = new Map<string, typeof report.consumption>();
  for (const row of report.consumption) {
    const key = JSON.stringify([row.substation_id, row.product_id, row.product, row.unit]);
    series.set(key, [...(series.get(key) ?? []), row]);
  }
  return (
    <div className="reports-workspace">
      <Panel
        title={dashboard ? "Situația activității" : "Filtre rapoarte"}
        description="Date autentificate. Început inclus, sfârșit exclus; calendar Europe/Bucharest."
      >
        <form method="get" className="report-filters">
          <label>
            De la
            <input type="date" name="from" defaultValue={filters.from} required />
          </label>
          <label>
            Până la (exclusiv)
            <input type="date" name="until" defaultValue={filters.until} required />
          </label>
          <label>
            Grupare
            <select name="group" defaultValue={filters.group}>
              {Object.entries(groups).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Arie
            <select name="scope" defaultValue={filters.scope}>
              <option value="station">Substația curentă</option>
              <option value="all">Toate substațiile autorizate</option>
            </select>
          </label>
          <label>
            Titular
            <select name="holder" defaultValue={filters.holder ?? ""}>
              <option value="">Toți titularii autorizați</option>
              {report.holders.map((h, i) => (
                <option key={`${h.id}-${i}`} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mașină
            <select name="vehicle" defaultValue={filters.vehicle ?? ""}>
              <option value="">Toate mașinile autorizate</option>
              {report.vehicles.map((v, i) => (
                <option key={`${v.id}-${i}`} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {filters.shift && (
            <label>
              Tură selectată
              <input name="shift" value={filters.shift} readOnly />
            </label>
          )}
          <Button type="submit">Aplică filtrele</Button>
          <Link
            href={`/substatia/${stationId}/${own ? "rapoarte-proprii" : dashboard ? "logistica" : "rapoarte"}`}
          >
            Resetează
          </Link>
        </form>
        <p className="report-summary">
          Substații incluse: {report.stations.map((s) => s.name).join(", ") || "Niciuna"}. Generat{" "}
          {moment(report.generated_at)}.
        </p>
        {own && <p className="report-summary">Sunt incluse exclusiv turele și rapoartele tale.</p>}
      </Panel>
      <div className="report-stats">
        <div>
          <span>Ture pornite, neînchise acum</span>
          <strong>{started}</strong>
        </div>
        <div>
          <span>Cereri fără fișă acum</span>
          <strong>{report.pending.filter((s) => s.state === "awaiting_issue").length}</strong>
        </div>
        <div>
          <span>Fișe de acceptat acum</span>
          <strong>{report.pending.filter((s) => s.state === "awaiting_acceptance").length}</strong>
        </div>
        <div>
          <span>Ture închise din intervalul operațional</span>
          <strong>{report.closed.length}</strong>
        </div>
      </div>
      {kinds.map((kind) => {
        const table = reportTable(report, kind);
        return (
          <Panel
            key={kind}
            title={reportKinds[kind]}
            description={reportNotes(report, kind, filters)[2]}
            action={
              <div className="report-exports">
                {["csv", "pdf"].map((format) => (
                  <a
                    className="button button-secondary"
                    key={format}
                    href={`/api/reports/aggregate?${exportQuery}&kind=${kind}&format=${format}`}
                  >
                    Descarcă {format.toUpperCase()}
                  </a>
                ))}
              </div>
            }
          >
            {!table.rows.length ? (
              <StateMessage
                kind="empty"
                title="Nicio înregistrare"
                description="Nu există date pentru selecția curentă."
              />
            ) : (
              <div className="report-table-scroll" tabIndex={0} aria-label={reportKinds[kind]}>
                <table className="report-table">
                  <thead>
                    <tr>
                      {table.headers.map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                      {kind === "closed" && <th scope="col">Raport individual</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                        {kind === "closed" && (
                          <td>
                            <a href={`/api/reports/shifts/${report.closed[i].id}`}>PDF tură</a>
                            <br />
                            <Link
                              href={`?${new URLSearchParams({ ...Object.fromEntries(filterQuery(filters)), shift: report.closed[i].id, group: "shift" })}`}
                            >
                              Filtrează tura
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })}
      {(filters.group === "day" || filters.group === "week") && series.size > 0 && (
        <Panel
          title="Evoluția consumului"
          description="Fiecare produs și substație are scară proprie. Barele reprezintă numai consum final; lipsa unei bare nu confirmă consum zero."
        >
          <div className="report-charts">
            {[...series.entries()].map(([key, rows]) => {
              const max = Math.max(...rows.map((r) => Number(r.consumed)), 1);
              return (
                <figure key={key}>
                  <figcaption>
                    {rows[0].product} · {rows[0].unit} · {rows[0].station}
                  </figcaption>
                  {rows.map((r, i) => (
                    <div className="report-bar-row" key={i}>
                      <span>{r.bucket}</span>
                      <span className="report-bar" aria-hidden="true">
                        <i style={{ width: `${(Number(r.consumed) / max) * 100}%` }} />
                      </span>
                      <strong>{r.consumed}</strong>
                    </div>
                  ))}
                </figure>
              );
            })}
          </div>
        </Panel>
      )}
      {dashboard && canViewLogistics(identity, stationId) && (
        <div className="station-links">
          <Link href={`/substatia/${stationId}/ture`}>Cereri și ture →</Link>
          <Link href={`/substatia/${stationId}/stocuri`}>Stocuri și recepții →</Link>
          <Link href={`/substatia/${stationId}/personal`}>Personal →</Link>
          <Link href={`/substatia/${stationId}/rapoarte?${filterQuery(filters)}`}>
            Toate rapoartele și exporturile →
          </Link>
        </div>
      )}
    </div>
  );
}

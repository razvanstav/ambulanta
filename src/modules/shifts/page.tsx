import { randomUUID } from "node:crypto";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, Panel, StateMessage, LinkButton } from "@/components/ui/primitives";
import { requireSubstation } from "@/modules/identity/server";
import { resolveMyHolder } from "@/modules/employees";
import { getAvailableVehicles } from "@/modules/vehicles";
import { getInventory } from "@/modules/inventory";
import { canOperateStock, formatQuantity } from "@/modules/inventory/rules";
import { units } from "@/modules/catalog/rules";
import { getShifts } from "./index";
import { IssueEditor } from "./issue-editor";
import { RefreshData } from "@/components/ui/refresh-data";
import { requestShift, acceptIssueSheet, changeIssueSheet, cancelShift } from "./actions";

const states = {
  awaiting_issue: "În așteptarea fișei",
  awaiting_acceptance: "Fișă de acceptat",
  open: "Tură pornită",
  pending_close: "În verificare",
  closed: "Închisă",
  cancelled: "Anulată",
};
const sheetStates = {
  draft: "Ciornă",
  sent: "Trimisă",
  disputed: "Neconcordanță semnalată",
  superseded: "Înlocuită",
  withdrawn: "Retrasă",
  accepted: "Acceptată",
};
const time = (date: string) =>
  new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
function Reason() {
  return (
    <label>
      Motivul acțiunii
      <input name="reason" minLength={5} maxLength={500} required />
    </label>
  );
}
export async function ShiftsWorkspace({
  stationId,
  own = false,
}: {
  stationId: string;
  own?: boolean;
}) {
  const { identity } = await requireSubstation(stationId);
  const { shifts, sheets, lines } = await getShifts(stationId, own);
  const manage = !own && canOperateStock(identity, stationId);
  const holder = own ? await resolveMyHolder(stationId) : null;
  const active = shifts.find((s) => !["closed", "cancelled"].includes(s.state));
  const vehicles = own && !active ? await getAvailableVehicles(stationId) : [];
  const inventory = manage ? await getInventory(stationId) : null;
  const options =
    inventory?.options
      .filter(
        (l) =>
          l.active &&
          !l.blocked &&
          (!l.expires_on ||
            l.expires_on >=
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Bucharest",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date())),
      )
      .map((l) => ({
        id: l.id,
        label: `${l.product.name} · ${l.lot_code} · ${formatQuantity(l.available)} ${units[l.product.base_unit]} disponibil`,
      })) ?? [];
  return (
    <>
      <div className="station-links">
        <RefreshData />
      </div>
      {own && (
        <Panel
          title={holder ? `Titular: ${holder.display_name}` : "Pregătirea turei"}
          description="Identitatea este stabilită din contul tău autentificat."
        >
          {holder ? (
            <p className="identity-note">
              {active
                ? "Ai o cerere sau o tură în curs. Mașina rămâne rezervată până la anulare sau închidere."
                : "Alege mașina și așteaptă fișa pregătită de magazie. Acceptarea fișei pornește efectiv tura."}
            </p>
          ) : (
            <StateMessage
              kind="waiting"
              title="Contul nu este asociat unui titular eligibil"
              description="Verifică împreună cu administratorul apartenența activă, bifa Titular și contul. Istoricul propriu rămâne mai jos."
            />
          )}
        </Panel>
      )}
      {own && holder && !active && (
        <Panel
          title="Start tură"
          description="Mașinile afișate sunt active, apte și libere. Intervalul planificat este opțional și folosește ora României."
        >
          {vehicles.length ? (
            <>
              <ul className="holder-list">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <span>
                      <strong>{v.identifier}</strong>
                      <small>{v.description}</small>
                    </span>
                    <Badge tone="green">Liberă</Badge>
                  </li>
                ))}
              </ul>
              <ActionForm action={requestShift} submitLabel="Solicită fișa și rezervă mașina">
                <input type="hidden" name="station" value={stationId} />
                <input type="hidden" name="request_key" value={randomUUID()} />
                <label>
                  Mașina pentru tură
                  <select name="vehicle" required defaultValue="">
                    <option value="" disabled>
                      Alege mașina
                    </option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.identifier} · {v.description}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-columns">
                  <label>
                    Început planificat
                    <input type="datetime-local" name="planned_start" />
                  </label>
                  <label>
                    Sfârșit planificat
                    <input type="datetime-local" name="planned_end" />
                  </label>
                </div>
              </ActionForm>
            </>
          ) : (
            <StateMessage
              kind="empty"
              title="Nicio mașină disponibilă"
              description="Mașinile sunt ocupate, inactive sau indisponibile tehnic."
            />
          )}
        </Panel>
      )}
      {!own && (
        <div className="people-stats">
          <div>
            <span>Cereri în așteptare</span>
            <strong>{shifts.filter((s) => s.state.startsWith("awaiting")).length}</strong>
          </div>
          <div>
            <span>Ture pornite</span>
            <strong>
              {shifts.filter((s) => ["open", "pending_close"].includes(s.state)).length}
            </strong>
          </div>
          <div>
            <span>Fișe de acceptat</span>
            <strong>{sheets.filter((s) => s.state === "sent").length}</strong>
          </div>
        </div>
      )}
      {!shifts.length && (
        <Panel title={own ? "Turele mele" : "Cereri și ture"}>
          <StateMessage
            kind="empty"
            title="Nicio cerere înregistrată"
            description="Șeful de tură inițiază Start tură din contul său."
          />
        </Panel>
      )}
      {shifts.map((shift) => {
        const versions = sheets.filter((s) => s.shift_id === shift.id);
        const pending = versions.find((s) => ["draft", "sent", "disputed"].includes(s.state));
        const acceptedIds = new Set(
          versions.filter((s) => s.state === "accepted").map((s) => s.id),
        );
        const allocations = lines.filter((l) => acceptedIds.has(l.sheet_id));
        return (
          <Panel
            key={shift.id}
            title={`${shift.vehicle_identifier} · ${shift.holder_name}`}
            description={`Cerere: ${time(shift.requested_at)}${shift.started_at ? ` · Pornită: ${time(shift.started_at)} · Data operațională: ${shift.operational_date}` : " · Tura nu a pornit încă"}`}
          >
            <div className="workspace-notice">
              <Badge tone={shift.state === "open" ? "green" : "amber"}>{states[shift.state]}</Badge>
              {shift.planned_start && (
                <p className="identity-note">
                  Planificat: {time(shift.planned_start)} – {time(shift.planned_end!)}
                </p>
              )}
            </div>
            {allocations.length > 0 && (
              <>
                <h3 className="catalog-subheading">Produse predate în tură</h3>
                <ul className="holder-list">
                  {allocations.map((line) => (
                    <li key={line.id}>
                      <span>
                        {line.product_name}
                        <small>{line.lot_code}</small>
                      </span>
                      <strong>
                        {formatQuantity(line.quantity)} {units[line.base_unit]}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="identity-note">
                  Consumul, returul și închiderea vor fi disponibile în modulele următoare.
                </p>
              </>
            )}
            <div className="admin-records">
              {versions.map((sheet) => (
                <details key={sheet.id} open={sheet.state === "sent" || sheet.state === "disputed"}>
                  <summary>
                    <span>
                      Fișa v{sheet.version} ·{" "}
                      {sheet.kind === "initial" ? "Predare inițială" : "Suplimentare"}
                      <small>{time(sheet.created_at)}</small>
                    </span>
                    <Badge tone={sheet.state === "accepted" ? "green" : "blue"}>
                      {sheetStates[sheet.state]}
                    </Badge>
                  </summary>
                  <ul className="holder-list">
                    {lines
                      .filter((l) => l.sheet_id === sheet.id)
                      .map((line) => (
                        <li key={line.id}>
                          <span>
                            {line.product_name}
                            <small>
                              {line.lot_code} · {line.expires_on ?? "fără expirare"}
                            </small>
                          </span>
                          <strong>
                            {formatQuantity(line.quantity)} {units[line.base_unit]}
                          </strong>
                        </li>
                      ))}
                  </ul>
                  <p className="identity-note">{sheet.note}</p>
                  {own && sheet.state === "sent" && (
                    <>
                      <ActionForm
                        action={acceptIssueSheet}
                        submitLabel={
                          sheet.kind === "initial"
                            ? "Accept fișa și pornesc tura"
                            : "Accept suplimentarea"
                        }
                      >
                        <input type="hidden" name="station" value={stationId} />
                        <input type="hidden" name="sheet" value={sheet.id} />
                        <input type="hidden" name="request_key" value={randomUUID()} />
                        <p className="identity-note">
                          Confirmi primirea cantităților din această versiune. Conținutul fișei este
                          stabilit de magazie.
                        </p>
                      </ActionForm>
                      <ActionForm action={changeIssueSheet} submitLabel="Semnalează neconcordanță">
                        <input type="hidden" name="station" value={stationId} />
                        <input type="hidden" name="sheet" value={sheet.id} />
                        <input type="hidden" name="operation" value="dispute" />
                        <Reason />
                      </ActionForm>
                    </>
                  )}
                  {manage && ["draft", "sent", "disputed"].includes(sheet.state) && (
                    <ActionForm action={changeIssueSheet} submitLabel="Retrage fișa">
                      <input type="hidden" name="station" value={stationId} />
                      <input type="hidden" name="sheet" value={sheet.id} />
                      <input type="hidden" name="operation" value="withdraw" />
                      <Reason />
                    </ActionForm>
                  )}
                </details>
              ))}
            </div>
            {manage &&
              identity.id !== shift.owner_id &&
              ["awaiting_issue", "awaiting_acceptance", "open"].includes(shift.state) && (
                <>
                  <h3 className="catalog-subheading">
                    {pending
                      ? "Înlocuiește fișa curentă"
                      : shift.started_at
                        ? "Pregătește suplimentare"
                        : "Pregătește fișa"}
                  </h3>
                  <IssueEditor
                    key={pending?.id ?? versions[0]?.id ?? shift.id}
                    stationId={stationId}
                    shiftId={shift.id}
                    expectedSheet={pending?.id ?? ""}
                    requestKey={randomUUID()}
                    options={options}
                    initial={
                      pending
                        ? lines
                            .filter((l) => l.sheet_id === pending.id)
                            .map((l) => ({ lot_id: l.lot_id, quantity: String(l.quantity) }))
                        : []
                    }
                  />
                </>
              )}
            {(own || manage) && shift.state.startsWith("awaiting") && (
              <ActionForm action={cancelShift} submitLabel="Anulează cererea">
                <input type="hidden" name="station" value={stationId} />
                <input type="hidden" name="shift" value={shift.id} />
                <Reason />
              </ActionForm>
            )}
          </Panel>
        );
      })}
      {!own && (
        <div className="station-links">
          <LinkButton href={`/substatia/${stationId}/stocuri`}>
            Vezi stocul și recepțiile
          </LinkButton>
        </div>
      )}
    </>
  );
}

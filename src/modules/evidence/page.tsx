import { groupProductLines, groupDeclarationLines } from "@/modules/inventory/product-lines";
import { randomUUID } from "node:crypto";
import { ActionForm } from "@/components/ui/action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canOperateStock, formatQuantity } from "@/modules/inventory/rules";
import { units, type Unit } from "@/modules/catalog/rules";
import type { Identity } from "@/modules/identity/policy";
import type { SheetLine, Shift } from "@/modules/shifts";
import { EndGate } from "@/modules/shifts/end-gate";
import { completeSimpleCloseout, confirmReturn } from "./actions";
import { DeclarationFields } from "./declaration-fields";
import type { CloseoutVersion } from "./types";

export async function EvidenceWorkspace({
  stationId,
  shift,
  allocations,
  identity,
  own,
}: {
  stationId: string;
  shift: Shift;
  allocations: SheetLine[];
  identity: Identity;
  own: boolean;
}) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("closeout_versions")
    .select("id,shift_id,version,content_hash,created_at,content")
    .eq("shift_id", shift.id)
    .order("version", { ascending: false });
  if (error) throw new Error("Declarația de consum nu poate fi încărcată.");
  const current = (data as CloseoutVersion[])[0];
  const isOwner = own && shift.owner_id === identity.id;
  const canClose = isOwner && shift.state === "open";

  return (
    <section className="closeout-workspace simple-closeout" aria-label="Încheierea turei">
      <div className="closeout-heading">
        <div>
          <p className="eyebrow">FINAL DE TURĂ</p>
          <h3>{shift.state === "closed" ? "Tura este închisă" : "Închide tura"}</h3>
        </div>
        {shift.state === "closed" && <span className="closeout-done">Finalizată</span>}
      </div>

      {canClose && (
        <>
          <p className="closeout-instruction">
            Scrie doar cât s-a consumat. Diferența rămâne automat în mașină.
          </p>
          <EndGate
            end={shift.planned_end}
            ready
            action={completeSimpleCloseout}
            label="Închide tura și actualizează stocul"
          >
            <input type="hidden" name="station" value={stationId} />
            <input type="hidden" name="shift" value={shift.id} />
            <input type="hidden" name="expected_version" value={current?.id ?? ""} />
            <input type="hidden" name="request_key" value={randomUUID()} />
            <div className="closeout-lines">
              {groupProductLines(allocations).map((line, index) => (
                <DeclarationFields
                  key={(current?.id ?? shift.id) + "-" + line.id}
                  line={line}
                  index={index}
                  previous={
                    current
                      ? {
                          ...current.content.lines[0],
                          consumed:
                            current.content.lines
                              .filter((item) =>
                                allocations.some(
                                  (a) =>
                                    a.id === item.allocation_id && a.product_id === line.product_id,
                                ),
                              )
                              .reduce(
                                (sum, item) => sum + Math.round(Number(item.consumed) * 1000),
                                0,
                              ) / 1000,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            <p className="closeout-result-note">
              La confirmare, consumul se scade și cantitatea rămasă devine stocul curent al mașinii{" "}
              {shift.vehicle_identifier}.
            </p>
          </EndGate>
        </>
      )}

      {!canClose && shift.state === "open" && (
        <p className="closeout-instruction">
          Titularul completează consumul și închide tura după ora programată.
        </p>
      )}

      {current && ["closed", "pending_close"].includes(shift.state) && (
        <ul className="holder-list closeout-summary">
          {groupDeclarationLines(current.content.lines, allocations).map((line) => (
            <li key={line.allocation_id}>
              <span>
                <strong>{line.product_name}</strong>
                <small>
                  Preluat {formatQuantity(line.issued)} {units[line.base_unit as Unit]}
                </small>
              </span>
              <span className="closeout-summary-values">
                <strong>Consumat {formatQuantity(line.consumed)}</strong>
                <small>
                  Rămas în mașină{" "}
                  {formatQuantity(
                    line.remaining ??
                      Number(line.issued) - Number(line.consumed) - Number(line.returned ?? 0),
                  )}{" "}
                  {units[line.base_unit as Unit]}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {shift.state === "pending_close" &&
        !own &&
        identity.id !== shift.owner_id &&
        canOperateStock(identity, stationId) &&
        current && (
          <div className="legacy-return">
            <p>Există un retur început înainte de simplificarea fluxului.</p>
            <ActionForm action={confirmReturn} submitLabel="Confirm returul vechi și închid tura">
              <input type="hidden" name="station" value={stationId} />
              <input type="hidden" name="version" value={current.id} />
              <input type="hidden" name="request_key" value={randomUUID()} />
              <label className="check-label">
                <input type="checkbox" name="confirm" required />
                Cantitățile returnate au fost primite în magazie.
              </label>
            </ActionForm>
          </div>
        )}
    </section>
  );
}

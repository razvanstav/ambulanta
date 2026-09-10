"use client";
import { useState } from "react";
import { formatQuantity } from "@/modules/inventory/rules";
import { units } from "@/modules/catalog/rules";
import type { SheetLine } from "@/modules/shifts";
import type { DeclarationLine } from "./types";

export function DeclarationFields({
  line,
  previous,
  index,
}: {
  line: SheetLine;
  previous?: DeclarationLine;
  index: number;
}) {
  const [consumed, setConsumed] = useState(String(previous?.consumed ?? 0));
  const [returned, setReturned] = useState(String(previous?.returned ?? 0));
  const remaining =
    (Math.round(Number(line.quantity) * 1000) -
      Math.round(Number(consumed.replace(",", ".")) * 1000) -
      Math.round(Number(returned.replace(",", ".")) * 1000)) /
    1000;
  return (
    <div className="closeout-line">
      <strong>
        {line.product_name} · {line.lot_code}
      </strong>
      <p>
        Preluat: {formatQuantity(line.quantity)} {units[line.base_unit]}
      </p>
      <input type="hidden" name="allocation_id" value={line.id} />
      <div className="form-columns">
        <label>
          Consumat — alocarea {index + 1}
          <input
            name="consumed"
            inputMode="decimal"
            required
            value={consumed}
            onChange={(event) => setConsumed(event.target.value)}
          />
        </label>
        <div className="remaining-stock" aria-live="polite">
          <span>Rămâne în mașină</span>
          <strong>
            {Number.isFinite(remaining) && remaining >= 0
              ? `${formatQuantity(remaining)} ${units[line.base_unit]}`
              : "Verifică valorile"}
          </strong>
        </div>
      </div>
      <details open={Number(returned) > 0}>
        <summary>Returnez fizic materiale în magazie</summary>
        <p className="identity-note">
          Completează doar ce predai efectiv magaziei. Materialele rămase în mașină nu sunt retur.
        </p>
        <label>
          Retur fizic — alocarea {index + 1}
          <input
            name="returned"
            inputMode="decimal"
            required
            value={returned}
            onChange={(event) => setReturned(event.target.value)}
          />
        </label>
      </details>
    </div>
  );
}

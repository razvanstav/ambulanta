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
  const remaining =
    (Math.round(Number(line.quantity) * 1000) -
      Math.round(Number(consumed.replace(",", ".")) * 1000)) /
    1000;
  return (
    <div className="closeout-line">
      <strong>{line.product_name}</strong>
      <p>
        Preluat: {formatQuantity(line.quantity)} {units[line.base_unit]}
      </p>
      <input type="hidden" name="product_id" value={line.product_id} />
      <input type="hidden" name="returned" value="0" />
      <div className="closeout-amounts">
        <label>
          Cât s-a consumat
          <input
            name="consumed"
            inputMode="decimal"
            aria-label={`Consumat — ${line.product_name}, produsul ${index + 1}`}
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
    </div>
  );
}

"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export type LotOption = { id: string; label: string };
export function StockLines({
  options,
  initial = [],
}: {
  options: LotOption[];
  initial?: { lot_id: string; quantity: string }[];
}) {
  const [lines, setLines] = useState(initial.length ? initial : [{ lot_id: "", quantity: "" }]);
  return (
    <div className="stock-lines">
      {lines.map((line, index) => (
        <div key={index} className="form-columns">
          <label>
            Lot {index + 1}
            <select
              name="lot_id"
              value={line.lot_id}
              onChange={(e) =>
                setLines(lines.map((l, i) => (i === index ? { ...l, lot_id: e.target.value } : l)))
              }
              required
            >
              <option value="">Alege produsul și lotul</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantitate {index + 1}
            <input
              name="quantity"
              inputMode="decimal"
              value={line.quantity}
              onChange={(e) =>
                setLines(
                  lines.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)),
                )
              }
              required
              maxLength={13}
            />
          </label>
          {lines.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLines(lines.filter((_, i) => i !== index))}
            >
              Elimină linia {index + 1}
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={lines.length >= 100}
        onClick={() => setLines([...lines, { lot_id: "", quantity: "" }])}
      >
        Adaugă linie
      </Button>
    </div>
  );
}

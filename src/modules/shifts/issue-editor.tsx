"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { StockLines, type ProductOption } from "@/modules/inventory/lines-form";
import type { ActionResult } from "@/components/ui/action-form";
import { saveIssueSheet } from "./actions";
export function IssueEditor({
  stationId,
  shiftId,
  expectedSheet,
  requestKey,
  options,
  initial,
  allowCarryOnly = false,
}: {
  stationId: string;
  shiftId: string;
  expectedSheet: string;
  requestKey: string;
  options: ProductOption[];
  allowCarryOnly?: boolean;
  initial: { product_id: string; quantity: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveIssueSheet, {
    message: "",
  });
  const [carryOnly, setCarryOnly] = useState(false);
  const [reason, setReason] = useState("");
  const [send, setSend] = useState("true");
  const [key] = useState(requestKey);
  return (
    <form action={action} className="identity-form">
      <fieldset disabled={pending || state.success}>
        <input type="hidden" name="station" value={stationId} />
        <input type="hidden" name="shift" value={shiftId} />
        <input type="hidden" name="expected_sheet" value={expectedSheet} />
        <input type="hidden" name="request_key" value={key} />
        {allowCarryOnly && (
          <label className="check-label">
            <input
              type="checkbox"
              name="carry_only"
              value="true"
              checked={carryOnly}
              onChange={(event) => setCarryOnly(event.target.checked)}
            />
            Preluare stoc existent, fără completare din magazie
          </label>
        )}
        {!carryOnly && <StockLines options={options} initial={initial} />}
        <label>
          Motivul fișei
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            maxLength={500}
            required
          />
        </label>
        <label>
          Salvare
          <select name="send" value={send} onChange={(e) => setSend(e.target.value)}>
            <option value="true">Trimite titularului pentru acceptare</option>
            <option value="false">Păstrează ca ciornă</option>
          </select>
        </label>
      </fieldset>
      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={state.success ? "form-success" : "form-error"}
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || state.success || (!options.length && !carryOnly)}>
        Salvează versiunea fișei
      </Button>
    </form>
  );
}

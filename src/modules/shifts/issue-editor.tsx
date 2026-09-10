"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { StockLines, type LotOption } from "@/modules/inventory/lines-form";
import type { ActionResult } from "@/components/ui/action-form";
import { saveIssueSheet } from "./actions";
export function IssueEditor({
  stationId,
  shiftId,
  expectedSheet,
  requestKey,
  options,
  initial,
}: {
  stationId: string;
  shiftId: string;
  expectedSheet: string;
  requestKey: string;
  options: LotOption[];
  initial: { lot_id: string; quantity: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveIssueSheet, {
    message: "",
  });
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
        <StockLines options={options} initial={initial} />
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
      <Button type="submit" disabled={pending || state.success || !options.length}>
        Salvează versiunea fișei
      </Button>
    </form>
  );
}

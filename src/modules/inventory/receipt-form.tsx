"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { StockLines, type ProductOption } from "./lines-form";
import { postReceipt } from "./actions";
import type { ActionResult } from "@/components/ui/action-form";

export function ReceiptForm({
  stationId,
  requestKey,
  today,
  options,
}: {
  stationId: string;
  requestKey: string;
  today: string;
  options: ProductOption[];
}) {
  const [key, setKey] = useState(requestKey);
  return (
    <>
      <ReceiptEntry
        key={key}
        stationId={stationId}
        requestKey={key}
        today={today}
        options={options}
      />
      <div className="panel-action">
        <Button variant="secondary" onClick={() => setKey(crypto.randomUUID())}>
          Formular pentru o recepție nouă
        </Button>
      </div>
    </>
  );
}
function ReceiptEntry({
  stationId,
  requestKey,
  today,
  options,
}: {
  stationId: string;
  requestKey: string;
  today: string;
  options: ProductOption[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(postReceipt, {
    message: "",
  });
  const [fields, setFields] = useState({
    document: "",
    date: today,
    supplier: "",
    reason: "",
    initial: false,
  });
  return (
    <form action={action} className="identity-form">
      <fieldset disabled={pending || state.success}>
        <input type="hidden" name="station" value={stationId} />
        <input type="hidden" name="request_key" value={requestKey} />
        <div className="form-columns">
          <label>
            Număr document
            <input
              name="document"
              value={fields.document}
              onChange={(e) => setFields({ ...fields, document: e.target.value })}
              required
              maxLength={80}
            />
          </label>
          <label>
            Data documentului
            <input
              type="date"
              name="date"
              value={fields.date}
              onChange={(e) => setFields({ ...fields, date: e.target.value })}
              required
            />
          </label>
          <label>
            Furnizor
            <input
              name="supplier"
              value={fields.supplier}
              onChange={(e) => setFields({ ...fields, supplier: e.target.value })}
              minLength={2}
              maxLength={150}
              required
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            name="initial"
            checked={fields.initial}
            onChange={(e) => setFields({ ...fields, initial: e.target.checked })}
          />
          Stoc inițial
        </label>
        <StockLines options={options} />
        <label>
          Motivul înregistrării
          <input
            name="reason"
            value={fields.reason}
            onChange={(e) => setFields({ ...fields, reason: e.target.value })}
            minLength={5}
            maxLength={500}
            required
          />
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
        {pending ? "Se înregistrează…" : "Confirmă recepția"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "./primitives";

export type ActionResult = { message: string; success?: boolean };
export type FormAction = (previous: ActionResult, form: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  submitLabel,
  disabled = false,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  return (
    <form action={formAction} className="identity-form" aria-busy={pending}>
      <fieldset disabled={disabled || pending}>{children}</fieldset>
      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={state.success ? "form-success" : "form-error"}
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={disabled || pending}>
        {pending ? "Se procesează…" : submitLabel}
      </Button>
    </form>
  );
}

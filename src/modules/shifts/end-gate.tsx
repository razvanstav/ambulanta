"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { FormAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/primitives";

export function EndGate({
  end,
  ready,
  action,
  children,
  label,
}: {
  end: string | null;
  ready: boolean;
  action: FormAction;
  children: ReactNode;
  label: string;
}) {
  const [elapsed, setElapsed] = useState(false);
  const [early, setEarly] = useState(false);
  const [state, formAction, pending] = useActionState(action, { message: "" });
  useEffect(() => {
    const check = () => setElapsed(Boolean(end) && Date.now() >= Date.parse(end!));
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [end]);
  return (
    <div className="closeout-submit">
      {!elapsed && (
        <p className="identity-note">
          {end
            ? `Închiderea se deblochează la ${new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "short" }).format(new Date(end))}. Poți pregăti declarația între timp.`
            : "Stabilește intervalul turei înainte de închidere."}
        </p>
      )}
      <form
        action={formAction}
        className="identity-form"
        aria-busy={pending}
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null;
          if (!ready || pending || (!elapsed && submitter?.value !== "early"))
            event.preventDefault();
        }}
      >
        <fieldset disabled={!ready || pending}>
          {children}
          {early && (
            <section aria-label="Confirmă închiderea anticipată">
              <p>
                Închizi tura acum, înainte de ora programată. Consumul de mai sus se scade, restul
                rămâne în mașină, iar mașina devine disponibilă. După confirmare, cantitățile nu mai
                pot fi modificate.
              </p>
              <label>
                Motivul închiderii anticipate
                <input name="early_reason" minLength={5} maxLength={500} required />
              </label>
              <label className="check-label">
                <input type="checkbox" name="early_confirm" required />
                Am verificat consumul și confirm închiderea turei acum.
              </label>
            </section>
          )}
        </fieldset>
        {state.message && (
          <p
            role={state.success ? "status" : "alert"}
            className={state.success ? "form-success" : "form-error"}
          >
            {state.message}
          </p>
        )}
        <div className="station-links">
          <Button type="submit" disabled={!elapsed || !ready || pending || early}>
            {pending ? "Se procesează…" : label}
          </Button>
          {early ? (
            <>
              <Button type="submit" name="close_mode" value="early" disabled={!ready || pending}>
                Confirm închiderea anticipată
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setEarly(false)}
              >
                Renunță
              </Button>
            </>
          ) : (
            !elapsed &&
            end && (
              <Button
                type="button"
                variant="secondary"
                disabled={!ready || pending}
                onClick={() => setEarly(true)}
              >
                Închide tura înainte
              </Button>
            )
          )}
        </div>
      </form>
    </div>
  );
}

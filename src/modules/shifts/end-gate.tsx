"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ActionForm, type FormAction } from "@/components/ui/action-form";

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
      <ActionForm action={action} submitLabel={label} disabled={!ready} submitDisabled={!elapsed}>
        {children}
      </ActionForm>
    </div>
  );
}

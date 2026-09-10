"use client";

import { Button, StateMessage } from "@/components/ui/primitives";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <StateMessage
      kind="error"
      title="Pagina nu a putut fi afișată"
      description="Încearcă să încarci din nou pagina. Dacă problema continuă, revino la privirea de ansamblu."
    >
      <Button onClick={reset}>Încearcă din nou</Button>
    </StateMessage>
  );
}

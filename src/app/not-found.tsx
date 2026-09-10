import { LinkButton, StateMessage } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <StateMessage
      kind="empty"
      title="Pagina nu a fost găsită"
      description="Adresa nu corespunde unui ecran din aplicație."
    >
      <LinkButton href="/" variant="secondary">
        La privirea de ansamblu
      </LinkButton>
    </StateMessage>
  );
}

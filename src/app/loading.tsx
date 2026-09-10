import { StateMessage } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <StateMessage
      kind="loading"
      title="Se încarcă pagina…"
      description="Pregătim conținutul pentru afișare."
    />
  );
}

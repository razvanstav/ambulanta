"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./primitives";
export function RefreshData() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Se actualizează…" : "Actualizează situația"}
    </Button>
  );
}

"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { canManageStation, isUuid } from "@/modules/identity/policy";
import type { ActionResult } from "@/components/ui/action-form";

export async function saveVehicle(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  if (!isUuid(station)) return { message: "Substație nevalidă." };
  const { identity } = await requireSubstation(station);
  if (!canManageStation(identity, station)) notFound();
  const id = String(form.get("vehicle") ?? "");
  const identifier = String(form.get("identifier") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  if (
    (id && !isUuid(id)) ||
    identifier.length < 2 ||
    identifier.length > 30 ||
    description.length < 2 ||
    description.length > 120 ||
    reason.length < 5 ||
    reason.length > 500
  )
    return { message: "Verifică indicativul, descrierea și motivul modificării." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("save_vehicle", {
    p_substation: station,
    p_vehicle: id || null,
    p_identifier: identifier,
    p_description: description,
    p_active: form.get("active") === "on",
    p_operational: form.get("operational") === "on",
    p_reason: reason,
  });
  if (error)
    return {
      message:
        error.code === "23505"
          ? "Există deja o mașină cu acest indicativ în instituție."
          : "Mașina nu a fost salvată. Verifică datele și drepturile contului.",
    };
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return { success: true, message: "Mașina a fost salvată. Lista disponibilă a fost actualizată." };
}

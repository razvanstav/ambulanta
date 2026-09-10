"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { canManageStation, isUuid } from "@/modules/identity/policy";
import type { ActionResult } from "@/components/ui/action-form";

export async function saveEmployee(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  if (!isUuid(station)) return { message: "Substație nevalidă." };
  const { identity } = await requireSubstation(station);
  if (!canManageStation(identity, station)) notFound();
  const id = String(form.get("employee") ?? "");
  const account = String(form.get("account") ?? "");
  const code = String(form.get("code") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const job = String(form.get("job") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  if (
    (id && !isUuid(id)) ||
    (account && !isUuid(account)) ||
    code.length < 2 ||
    code.length > 30 ||
    name.length < 2 ||
    name.length > 120 ||
    job.length < 2 ||
    job.length > 100 ||
    reason.length < 5 ||
    reason.length > 500
  )
    return { message: "Verifică numele, codul, funcția și motivul modificării." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("save_employee", {
    p_substation: station,
    p_employee: id || null,
    p_code: code,
    p_name: name,
    p_job_title: job,
    p_active: form.get("active") === "on",
    p_is_titular: form.get("titular") === "on",
    p_account: account || null,
    p_reason: reason,
  });
  if (error)
    return {
      message:
        error.code === "23505"
          ? "Codul sau contul este deja asociat unui angajat."
          : "Angajatul nu a fost salvat. Verifică datele și dreptul de asociere a contului.",
    };
  revalidatePath(`/substatia/${station}`, "page");
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return {
    success: true,
    message: "Angajatul a fost salvat. Eligibilitatea titularilor a fost actualizată.",
  };
}

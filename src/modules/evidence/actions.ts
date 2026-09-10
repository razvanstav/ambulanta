"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { isUuid } from "@/modules/identity/policy";
import type { ActionResult } from "@/components/ui/action-form";

function finish(error: { message?: string } | null, message: string): ActionResult {
  if (error)
    return {
      message:
        "Salvarea a fost refuzată. Verifică drepturile, cantitățile și versiunea curentă; reîncarcă pagina.",
    };
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return { success: true, message };
}
export async function saveDraft(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  await requireSubstation(station);
  const shift = String(form.get("shift") ?? "");
  const version = String(form.get("expected_version") ?? "");
  const key = String(form.get("request_key") ?? "");
  const ids = form.getAll("allocation_id").map(String);
  const consumed = form.getAll("consumed").map((v) => String(v).replace(",", "."));
  const returned = form.getAll("returned").map((v) => String(v).replace(",", "."));
  if (
    !isUuid(shift) ||
    !isUuid(key) ||
    (version && !isUuid(version)) ||
    !ids.length ||
    ids.length > 1000 ||
    ids.some((id) => !isUuid(id)) ||
    ids.length !== consumed.length ||
    ids.length !== returned.length ||
    [...consumed, ...returned].some((v) => !/^\d{1,9}(\.\d{1,3})?$/.test(v))
  )
    return { message: "Completează cantități pozitive sau zero pentru fiecare alocare." };
  const client = await createSupabaseServerClient();
  const { data } = await client
    .from("shifts")
    .select("id")
    .eq("id", shift)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) return { message: "Tura nu este accesibilă." };
  const { error } = await client.rpc("save_closeout_draft", {
    p_shift: shift,
    p_expected_version: version || null,
    p_request_key: key,
    p_lines: ids.map((id, i) => ({
      allocation_id: id,
      consumed: consumed[i],
      returned: returned[i],
    })),
  });
  return finish(
    error,
    "Ciorna a fost salvată într-o versiune nouă. Atașează dovezile pentru această versiune.",
  );
}

export async function completeSimpleCloseout(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  await requireSubstation(station);
  const shift = String(form.get("shift") ?? "");
  const version = String(form.get("expected_version") ?? "");
  const key = String(form.get("request_key") ?? "");
  const ids = form.getAll("allocation_id").map(String);
  const consumed = form.getAll("consumed").map((value) => String(value).replace(",", "."));
  if (
    !isUuid(shift) ||
    !isUuid(key) ||
    (version && !isUuid(version)) ||
    !ids.length ||
    ids.length > 1000 ||
    ids.some((id) => !isUuid(id)) ||
    ids.length !== consumed.length ||
    consumed.some((value) => !/^\d{1,9}(\.\d{1,3})?$/.test(value))
  )
    return { message: "Completează cantitatea consumată pentru fiecare produs." };

  const client = await createSupabaseServerClient();
  const { data } = await client
    .from("shifts")
    .select("id")
    .eq("id", shift)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) return { message: "Tura nu este accesibilă." };

  const { error } = await client.rpc("close_shift_simple", {
    p_shift: shift,
    p_expected_version: version || null,
    p_request_key: key,
    p_lines: ids.map((id, index) => ({
      allocation_id: id,
      consumed: consumed[index],
      returned: "0",
    })),
  });
  if (error?.message?.includes("finalul programat"))
    return { message: "Tura poate fi închisă numai după data și ora finalului programat." };
  return finish(error, "Tura a fost închisă. Restul materialelor a rămas în stocul mașinii.");
}
export async function removeEvidence(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireSubstation(String(form.get("station") ?? ""));
  const id = String(form.get("evidence") ?? "");
  if (!isUuid(id)) return { message: "Dovadă nevalidă." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("remove_draft_evidence", { p_evidence: id });
  return finish(error, "Dovada a fost eliminată din ciornă.");
}
export async function setEvidencePolicy(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  await requireSubstation(station);
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("set_evidence_policy", {
    p_substation: station,
    p_policy: String(form.get("policy") ?? ""),
    p_reason: String(form.get("reason") ?? ""),
  });
  return finish(error, "Politica dovezilor a fost salvată pentru această substație.");
}

async function closeoutAction(form: FormData, confirm: boolean): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  await requireSubstation(station);
  const version = String(form.get("version") ?? "");
  const key = String(form.get("request_key") ?? "");
  if (!isUuid(version) || !isUuid(key) || (confirm && form.get("confirm") !== "on"))
    return { message: "Verifică declarația și confirmarea returului." };
  const client = await createSupabaseServerClient();
  const { data } = await client
    .from("closeout_versions")
    .select("id")
    .eq("id", version)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) return { message: "Declarația nu este accesibilă." };
  const { error } = await client.rpc(
    confirm ? "confirm_vehicle_return" : "submit_vehicle_closeout",
    { p_version: version, p_request_key: key },
  );
  if (error?.message?.includes("finalul programat"))
    return { message: "Tura poate fi închisă numai după data și ora finalului programat." };
  return finish(
    error,
    confirm
      ? "Returul fizic a fost confirmat și tura închisă."
      : "Declarația a fost confirmată. Dacă ai declarat retur fizic, tura așteaptă confirmarea magaziei; altfel este închisă.",
  );
}
export async function submitCloseout(_previous: ActionResult, form: FormData) {
  return closeoutAction(form, false);
}
export async function confirmReturn(_previous: ActionResult, form: FormData) {
  return closeoutAction(form, true);
}

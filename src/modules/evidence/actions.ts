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

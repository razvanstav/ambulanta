"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { canUseMyShift, isUuid } from "@/modules/identity/policy";
import { canOperateStock } from "@/modules/inventory/rules";
import { readStockLines } from "@/modules/inventory/validation";
import type { ActionResult } from "@/components/ui/action-form";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
async function context(form: FormData, warehouse = false) {
  const station = value(form, "station");
  if (!isUuid(station)) notFound();
  const { identity } = await requireSubstation(station);
  if (
    warehouse
      ? !canOperateStock(identity, station)
      : !canUseMyShift(identity, station) && !canOperateStock(identity, station)
  )
    notFound();
  return { station, identity, client: await createSupabaseServerClient() };
}
function finish(error: { code?: string; message?: string } | null, message: string): ActionResult {
  if (error)
    return {
      message: error.message?.includes("Stoc insuficient")
        ? "Stoc insuficient. Fișa nu a fost acceptată și tura nu a fost pornită. Magazia trebuie să verifice disponibilul."
        : error.code === "23505"
          ? "Mașina sau titularul are deja o cerere ori o tură activă. Reîncarcă lista."
          : "Operația a fost refuzată. Verifică drepturile, eligibilitatea, versiunea fișei și loturile. Reîncarcă pagina înainte să încerci din nou.",
    };
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return { success: true, message };
}
export async function requestShift(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { station, identity, client } = await context(form);
  if (!canUseMyShift(identity, station)) notFound();
  const vehicle = value(form, "vehicle");
  const key = value(form, "request_key");
  const start = value(form, "planned_start");
  const end = value(form, "planned_end");
  if (
    !isUuid(vehicle) ||
    !isUuid(key) ||
    !start ||
    !end ||
    (start &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) ||
        end <= start))
  )
    return {
      message: "Selectează mașina și stabilește un interval valid în ora României.",
    };
  const { error } = await client.rpc("request_shift", {
    p_substation: station,
    p_vehicle: vehicle,
    p_request_key: key,
    p_planned_start: start || null,
    p_planned_end: end || null,
  });
  return finish(error, "Cererea a fost creată și mașina rezervată. Aștepți fișa magaziei.");
}
export async function saveIssueSheet(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, client } = await context(form, true);
  const shift = value(form, "shift");
  const expected = value(form, "expected_sheet");
  const key = value(form, "request_key");
  const reason = value(form, "reason");
  const lines = value(form, "carry_only") === "true" ? [] : readStockLines(form);
  if (
    !isUuid(shift) ||
    (expected && !isUuid(expected)) ||
    !isUuid(key) ||
    reason.length < 5 ||
    reason.length > 500 ||
    !lines
  )
    return {
      message:
        "Completează liniile și motivul. Loturile nu se repetă, iar cantitățile sunt pozitive.",
    };
  const { data } = await client
    .from("shifts")
    .select("id")
    .eq("id", shift)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) notFound();
  const send = value(form, "send") === "true";
  const { error } = await client.rpc("save_issue_sheet", {
    p_shift: shift,
    p_expected_sheet: expected || null,
    p_request_key: key,
    p_send: send,
    p_lines: lines,
    p_reason: reason,
  });
  return finish(
    error,
    send
      ? "Fișa a fost trimisă. Stocul se schimbă numai la acceptarea titularului."
      : "Ciorna a fost salvată. Stocul este neschimbat.",
  );
}
export async function acceptIssueSheet(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, identity, client } = await context(form);
  if (!canUseMyShift(identity, station)) notFound();
  const sheet = value(form, "sheet");
  const key = value(form, "request_key");
  if (!isUuid(sheet) || !isUuid(key)) return { message: "Fișă nevalidă." };
  const { data } = await client
    .from("issue_sheet_versions")
    .select("shift_id")
    .eq("id", sheet)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) notFound();
  const { data: shift } = await client
    .from("shifts")
    .select("owner_id")
    .eq("id", data.shift_id)
    .single();
  if (shift?.owner_id !== identity.id) notFound();
  const { error } = await client.rpc("accept_issue_sheet", { p_sheet: sheet, p_request_key: key });
  return finish(error, "Fișa a fost acceptată și produsele au fost predate în tură.");
}
export async function changeIssueSheet(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const operation = value(form, "operation");
  const { station, client } = await context(form, operation === "withdraw");
  const sheet = value(form, "sheet");
  const reason = value(form, "reason");
  if (
    !isUuid(sheet) ||
    !["dispute", "withdraw"].includes(operation) ||
    reason.length < 5 ||
    reason.length > 500
  )
    return { message: "Completează motivul acțiunii." };
  const { data } = await client
    .from("issue_sheet_versions")
    .select("id")
    .eq("id", sheet)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) notFound();
  const { error } = await client.rpc("change_issue_sheet", {
    p_sheet: sheet,
    p_action: operation,
    p_reason: reason,
  });
  return finish(
    error,
    operation === "dispute"
      ? "Neconcordanța a fost trimisă magaziei. Este necesară o fișă nouă."
      : "Fișa a fost retrasă și nu mai poate fi acceptată.",
  );
}
export async function cancelShift(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { station, client } = await context(form);
  const shift = value(form, "shift");
  const reason = value(form, "reason");
  if (!isUuid(shift) || reason.length < 5 || reason.length > 500)
    return { message: "Completează motivul anulării." };
  const { data } = await client
    .from("shifts")
    .select("id")
    .eq("id", shift)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) notFound();
  const { error } = await client.rpc("cancel_shift", { p_shift: shift, p_reason: reason });
  return finish(error, "Cererea a fost anulată și mașina eliberată.");
}

export async function setLegacySchedule(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, client } = await context(form);
  const shift = value(form, "shift");
  const start = value(form, "planned_start");
  const end = value(form, "planned_end");
  if (
    !isUuid(shift) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) ||
    end <= start
  )
    return { message: "Completează intervalul turei." };
  const { data } = await client
    .from("shifts")
    .select("id")
    .eq("id", shift)
    .eq("substation_id", station)
    .maybeSingle();
  if (!data) notFound();
  const { error } = await client.rpc("set_legacy_shift_schedule", {
    p_shift: shift,
    p_start: start,
    p_end: end,
  });
  return finish(error, "Intervalul a fost stabilit. Închiderea se permite după finalul programat.");
}

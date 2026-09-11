"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { isUuid } from "@/modules/identity/policy";
import { validExpiry } from "@/modules/catalog/rules";
import { canOperateStock } from "./rules";
import { readStockLines } from "./validation";
import type { ActionResult } from "@/components/ui/action-form";

export async function postReceipt(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const station = String(form.get("station") ?? "");
  if (!isUuid(station)) notFound();
  const { identity } = await requireSubstation(station);
  if (!canOperateStock(identity, station)) notFound();
  const key = String(form.get("request_key") ?? "");
  const document = String(form.get("document") ?? "").trim();
  const date = String(form.get("date") ?? "");
  const supplier = String(form.get("supplier") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const lines = readStockLines(form);
  if (
    !isUuid(key) ||
    !document ||
    document.length > 80 ||
    !validExpiry(date) ||
    supplier.length < 2 ||
    supplier.length > 150 ||
    reason.length < 5 ||
    reason.length > 500 ||
    !lines
  )
    return {
      message:
        "Verifică documentul, furnizorul, motivul și liniile. Cantitățile trebuie să fie pozitive, în unitatea de bază.",
    };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("post_product_receipt", {
    p_substation: station,
    p_request_key: key,
    p_document_number: document,
    p_document_date: date,
    p_supplier: supplier,
    p_initial: form.get("initial") === "on",
    p_lines: lines,
    p_reason: reason,
  });
  if (error)
    return {
      message:
        "Recepția nu a fost înregistrată. Verifică produsele, cantitățile și cheia cererii. Nu s-a aplicat nicio cantitate parțială.",
    };
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return { success: true, message: "Recepția a fost înregistrată și stocul a fost actualizat." };
}

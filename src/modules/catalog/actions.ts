"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/ui/action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { canViewLogistics, isUuid } from "@/modules/identity/policy";
import { canManageCatalog, categories, units, isIndivisible, validExpiry } from "./rules";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
async function context(form: FormData, common = false) {
  const station = value(form, "station");
  if (!isUuid(station)) notFound();
  const { identity } = await requireSubstation(station);
  if (!canViewLogistics(identity, station) || (common && !canManageCatalog(identity))) notFound();
  return { station, client: await createSupabaseServerClient() };
}
function finish(error: { code?: string } | null, message: string): ActionResult {
  if (error)
    return {
      message:
        error.code === "23505"
          ? "Acest cod există deja. Verifică lista înainte să adaugi din nou."
          : error.code === "23514"
            ? "Unitatea și tipul cantității sunt fixe după înregistrarea produsului în stoc."
            : "Salvarea a fost refuzată. Verifică datele și drepturile contului.",
    };
  revalidatePath("/substatia/[substationId]/[[...section]]", "page");
  return { success: true, message };
}
function reason(form: FormData) {
  const text = value(form, "reason");
  return text.length >= 5 && text.length <= 500 ? text : null;
}

export async function saveProduct(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { station, client } = await context(form, true);
  const id = value(form, "product");
  const code = value(form, "code");
  const name = value(form, "name");
  const category = value(form, "category");
  const unit = value(form, "unit");
  const precisionText = value(form, "precision");
  const precision = Number(precisionText);

  if (
    (id && !isUuid(id)) ||
    code.length < 2 ||
    code.length > 30 ||
    name.length < 2 ||
    name.length > 150 ||
    !Object.hasOwn(categories, category) ||
    !Object.hasOwn(units, unit) ||
    !/^[0-3]$/.test(precisionText) ||
    (isIndivisible(unit) && precision !== 0) ||
    !reason(form)
  )
    return {
      message: "Verifică toate câmpurile. Unitățile indivizibile cer cantități întregi.",
    };
  const { error } = await client.rpc("save_simple_product", {
    p_substation: station,
    p_product: id || null,
    p_code: code,
    p_name: name,
    p_category: category,
    p_base_unit: unit,
    p_precision: precision,

    p_active: form.get("active") === "on",
    p_reason: reason(form),
  });
  return finish(error, "Produsul a fost salvat în catalogul instituției.");
}
export async function saveStationProduct(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, client } = await context(form);
  const id = value(form, "product");
  if (!isUuid(id) || !reason(form)) return { message: "Produs sau motiv nevalid." };
  const { error } = await client.rpc("save_station_product", {
    p_substation: station,
    p_product: id,
    p_minimum: 0,
    p_active: form.get("local_active") === "on",
    p_reason: reason(form),
  });
  return finish(error, "Disponibilitatea a fost salvată în această substație.");
}
export async function createStockLot(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, client } = await context(form);
  const id = value(form, "product");
  const code = value(form, "lot_code");
  const expiry = value(form, "expires_on");
  if (!isUuid(id) || code.length > 80 || (expiry && !validExpiry(expiry)) || !reason(form))
    return { message: "Verifică produsul, codul lotului, data expirării și motivul." };
  const { error } = await client.rpc("create_stock_lot", {
    p_substation: station,
    p_product: id,
    p_lot_code: code || null,
    p_expires_on: expiry || null,
    p_reason: reason(form),
  });
  return finish(error, "Lotul a fost înregistrat. Cantitățile se vor încărca prin recepții.");
}
export async function setStockLotBlocked(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const { station, client } = await context(form);
  const id = value(form, "lot");
  if (!isUuid(id) || !reason(form)) return { message: "Lot sau motiv nevalid." };
  const { error } = await client.rpc("set_stock_lot_blocked", {
    p_substation: station,
    p_lot: id,
    p_blocked: form.get("blocked") === "on",
    p_reason: reason(form),
  });
  return finish(error, "Starea lotului a fost salvată.");
}

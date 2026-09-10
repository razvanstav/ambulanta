import { readFile } from "node:fs/promises";
import { checked, configuration, login } from "./supabase-tools.mjs";

const initial = JSON.parse(
  await readFile(new URL("../private/initial-admin.json", import.meta.url), "utf8"),
);
if (initial.url !== configuration().url)
  throw new Error("Proiectul demo nu corespunde administratorului local.");
const client = await login(initial);
const institution = checked(
  await client.from("institutions").select("id,name").eq("name", "SAJ — Demonstrație").single(),
  "Instituție demo",
);
const station = checked(
  await client
    .from("substations")
    .select("id,active")
    .eq("institution_id", institution.id)
    .eq("name", "Roșiori")
    .single(),
  "Roșiori demo",
);
if (!station.active) throw new Error("Substație demo inactivă.");
const examples = [
  ["DEMO-MED-01", "Medicament demonstrativ A", "medication", "fiola", 0, true, true, "10"],
  ["DEMO-MED-02", "Medicament demonstrativ B", "medication", "comprimat", 0, true, true, "20"],
  ["DEMO-CONS-01", "Seringă demonstrativă", "consumable", "buc", 0, true, true, "30"],
  ["DEMO-CONS-02", "Mănuși demonstrative", "consumable", "pereche", 0, false, false, "50"],
  ["DEMO-CONS-03", "Material demonstrativ la metru", "consumable", "m", 2, false, false, "2.50"],
  ["DEMO-ACC-01", "Accesoriu demonstrativ", "accessory", "buc", 0, false, false, "2"],
];
let addedProducts = 0;
let addedSettings = 0;
let addedLots = 0;
for (const [code, name, category, unit, precision, trackLots, trackExpiry, minimum] of examples) {
  let product = checked(
    await client
      .from("products")
      .select("id,active,track_lots,track_expiry")
      .eq("code", code)
      .maybeSingle(),
    "Produs existent",
  );
  if (!product) {
    const id = checked(
      await client.rpc("save_product", {
        p_substation: station.id,
        p_product: null,
        p_code: code,
        p_name: name,
        p_category: category,
        p_base_unit: unit,
        p_precision: precision,
        p_track_lots: trackLots,
        p_track_expiry: trackExpiry,
        p_active: true,
        p_reason: "Populare catalog fictiv M04",
      }),
      "Adăugare produs demo",
    );
    product = { id, active: true, track_lots: trackLots, track_expiry: trackExpiry };
    addedProducts++;
  }
  let setting = checked(
    await client
      .from("station_product_settings")
      .select("active")
      .eq("product_id", product.id)
      .eq("substation_id", station.id)
      .maybeSingle(),
    "Prag existent",
  );
  if (!setting) {
    checked(
      await client.rpc("save_station_product", {
        p_substation: station.id,
        p_product: product.id,
        p_minimum: minimum,
        p_active: true,
        p_reason: "Prag fictiv Roșiori M04",
      }),
      "Prag demo",
    );
    setting = { active: true };
    addedSettings++;
  }
  const lots = checked(
    await client
      .from("stock_lots")
      .select("id")
      .eq("product_id", product.id)
      .eq("substation_id", station.id),
    "Loturi existente",
  );
  if (!lots.length && product.active && setting.active) {
    checked(
      await client.rpc("create_stock_lot", {
        p_substation: station.id,
        p_product: product.id,
        p_lot_code: product.track_lots ? `${code}-LOT-01` : null,
        p_expires_on: product.track_expiry ? "2028-12-31" : null,
        p_reason: "Lot fictiv Roșiori M04",
      }),
      "Lot demo",
    );
    addedLots++;
  }
}
console.log(
  `M04 demo: ${addedProducts} produse, ${addedSettings} praguri și ${addedLots} loturi adăugate. Datele existente nu au fost suprascrise.`,
);

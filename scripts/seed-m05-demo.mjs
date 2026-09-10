import { readFile } from "node:fs/promises";
import { checked, configuration, login } from "./supabase-tools.mjs";
const initial = JSON.parse(
  await readFile(new URL("../private/initial-admin.json", import.meta.url), "utf8"),
);
if (initial.url !== configuration().url)
  throw new Error("Proiectul demo nu corespunde administratorului.");
const client = await login(initial);
const institution = checked(
  await client.from("institutions").select("id").eq("name", "SAJ — Demonstrație").single(),
  "Instituție demo",
);
const station = checked(
  await client
    .from("substations")
    .select("id,active")
    .eq("institution_id", institution.id)
    .eq("name", "Roșiori")
    .single(),
  "Substație demo",
);
if (!station.active) throw new Error("Substația demo este inactivă.");
const key = "05000000-0000-4000-8000-000000000001";
const existing = checked(
  await client
    .from("inventory_operations")
    .select("kind,request_payload")
    .eq("substation_id", station.id)
    .eq("request_key", key)
    .maybeSingle(),
  "Stoc inițial existent",
);
if (existing) {
  if (existing.kind !== "initial" || existing.request_payload.document !== "DEMO-INITIAL-M05")
    throw new Error("Cheia este ocupată de altă operație.");
  console.log("Stocul inițial demo există deja. Nu a fost adăugată nicio cantitate.");
} else {
  const quantities = {
    "DEMO-MED-01": "100",
    "DEMO-MED-02": "200",
    "DEMO-CONS-01": "150",
    "DEMO-CONS-02": "200",
    "DEMO-CONS-03": "25.50",
    "DEMO-ACC-01": "10",
  };
  const products = checked(
    await client.from("products").select("id,code").in("code", Object.keys(quantities)),
    "Produse demo",
  );
  if (products.length !== 6) throw new Error("Rulează seed:m04 înainte de stocul inițial.");
  const lines = [];
  for (const product of products) {
    const lot = checked(
      await client
        .from("stock_lots")
        .select("id")
        .eq("substation_id", station.id)
        .eq("product_id", product.id)
        .order("created_at")
        .limit(1)
        .single(),
      "Lot demo",
    );
    lines.push({ lot_id: lot.id, quantity: quantities[product.code] });
  }
  checked(
    await client.rpc("post_receipt", {
      p_substation: station.id,
      p_request_key: key,
      p_document_number: "DEMO-INITIAL-M05",
      p_document_date: "2026-09-10",
      p_supplier: "Furnizor demonstrativ — date fictive",
      p_initial: true,
      p_lines: lines,
      p_reason: "Stoc inițial fictiv pentru prezentarea M05–M06",
    }),
    "Stoc inițial demo",
  );
  console.log(
    "Recepție demo salvată pentru 6 produse. Cantitățile rămân separate pe unitate și lot.",
  );
}

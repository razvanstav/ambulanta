import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { checked, configuration, privilegedClient } from "./supabase-tools.mjs";

// Read-only demo export. This is not a production backup/restore implementation.
const { url } = configuration();
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(url).hostname.split(".")[0]);
const initial = JSON.parse(
  await readFile(new URL("../private/initial-admin.json", import.meta.url), "utf8"),
);
const client = privilegedClient();
const institution = checked(
  await client.from("institutions").select("*").eq("id", initial.institutionId).single(),
  "Instituția demo",
);
assert.equal(institution.name, "SAJ — Demonstrație", "Export limitat la instituția demonstrativă");
const tables = [
  "substations",
  "profiles",
  "role_assignments",
  "employees",
  "employee_assignments",
  "vehicles",
  "products",
  "station_product_settings",
  "stock_lots",
  "shifts",
  "inventory_locations",
  "inventory_operations",
  "inventory_movements",
  "stock_balances",
  "receipts",
  "receipt_lines",
  "issue_sheet_versions",
  "issue_sheet_lines",
  "issue_sheet_acceptances",
  "shift_stock_allocations",
  "closeout_versions",
  "evidence_files",
  "audit_events",
];
const data = { institutions: [institution] };
for (const table of tables) {
  data[table] = [];
  for (let offset = 0; ; offset += 500) {
    const page = checked(
      await client
        .from(table)
        .select("*")
        .eq("institution_id", institution.id)
        .order("id")
        .range(offset, offset + 499),
      table,
    );
    data[table].push(...page);
    if (page.length < 500) break;
  }
}
const scaled = (value) => {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
};
const expected = new Map();
for (const movement of data.inventory_movements) {
  for (const [location, sign] of [
    [movement.source_id, -1n],
    [movement.destination_id, 1n],
  ]) {
    if (!location) continue;
    const key = `${location}/${movement.lot_id}`;
    expected.set(key, (expected.get(key) ?? 0n) + sign * scaled(movement.quantity));
  }
}
for (const balance of data.stock_balances) {
  const key = `${balance.location_id}/${balance.lot_id}`;
  assert.equal(scaled(balance.quantity), expected.get(key) ?? 0n, "Reconciliere sold/jurnal");
  expected.delete(key);
}
assert.ok([...expected.values()].every((quantity) => quantity === 0n));
const folder = new URL(
  `../backups/demo-${new Date().toISOString().replace(/[:.]/g, "-")}/`,
  import.meta.url,
);
await mkdir(folder, { recursive: true });
for (const evidence of data.evidence_files) {
  assert.ok(data.substations.some((s) => evidence.object_path.startsWith(`${s.id}/`)));
  const blob = checked(
    await client.storage.from("shift-evidence").download(evidence.object_path),
    "Dovadă privată",
  );
  await writeFile(new URL(`${evidence.id}.bin`, folder), Buffer.from(await blob.arrayBuffer()));
}
await writeFile(
  new URL("data.json", folder),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), project: new URL(url).hostname.split(".")[0], data },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `Export demo local: ${data.stock_balances.length} solduri, ${data.inventory_movements.length} mișcări, ${data.evidence_files.length} dovezi; reconciliere fără diferențe.`,
);
console.log(folder.pathname);

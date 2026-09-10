import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { checked, configuration, login, publicClient } from "../../scripts/supabase-tools.mjs";
const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const f = JSON.parse(await readFile(file, "utf8"));
assert.equal(f.url, configuration().url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(f.url).hostname.split(".")[0]);
assert.equal(f.m05, undefined);
const s = {};
for (const name of ["adminA", "warehouseA", "warehouseB", "manager", "leaderA"])
  s[name] = await login(f.accounts[name]);
const station = f.stations.A;
const d = f.m04;
const rpc = async (c, n, a) => checked(await c.rpc(n, a), n);
const denied = (r) => assert.ok(r.error, "Cererea trebuia refuzată");
const rows = async (table) => checked(await s.adminA.from(table).select("*"), table);
const args = (overrides = {}) => ({
  p_substation: station,
  p_request_key: randomUUID(),
  p_document_number: "TEST-M05",
  p_document_date: "2026-09-10",
  p_supplier: "Furnizor fictiv",
  p_initial: false,
  p_lines: [{ lot_id: d.lot, quantity: "100" }],
  p_reason: "Recepție de verificare M05",
  ...overrides,
});
const balance = async (lot) =>
  (await rows("stock_balances"))
    .filter((b) => b.substation_id === station && b.lot_id === lot)
    .reduce((sum, b) => sum + b.quantity, 0);
let passed = 0;
async function verify(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const first = f.m05Attempt ?? args();
f.m05Attempt = first;
await writeFile(file, JSON.stringify(f, null, 2), { mode: 0o600 });
await verify("recepție 100 și replay, inclusiv concurent, fără dublare", async () => {
  const results = await Promise.all([0, 1].map(() => s.warehouseA.rpc("post_receipt", first)));
  results.forEach((r) => checked(r, "Recepție concurentă"));
  assert.equal(results[0].data, results[1].data);
  assert.equal(await balance(d.lot), 100);
  assert.equal(await rpc(s.warehouseA, "post_receipt", first), results[0].data);
  denied(await s.warehouseA.rpc("post_receipt", { ...first, p_supplier: "Alt furnizor" }));
});
await verify("o linie invalidă anulează recepția, soldurile, mișcările și auditul", async () => {
  const tables = [
    "receipts",
    "receipt_lines",
    "inventory_operations",
    "inventory_movements",
    "audit_events",
  ];
  const before = await Promise.all(tables.map(async (t) => (await rows(t)).length));
  for (const bad of [
    { lot_id: d.internal, quantity: "1.5" },
    { lot_id: d.lotB, quantity: "1" },
    { lot_id: randomUUID(), quantity: "1" },
    { lot_id: d.internal, quantity: "-1" },
    { lot_id: d.internal, quantity: "NaN" },
  ])
    denied(
      await s.warehouseA.rpc(
        "post_receipt",
        args({ p_lines: [{ lot_id: d.lot, quantity: "3" }, bad] }),
      ),
    );
  assert.equal(await balance(d.lot), 100);
  assert.deepEqual(await Promise.all(tables.map(async (t) => (await rows(t)).length)), before);
});
await verify("drepturi de magazie, izolare și interdicția scrierilor directe", async () => {
  for (const name of ["manager", "leaderA", "warehouseB"])
    denied(await s[name].rpc("post_receipt", args()));
  for (const table of [
    "inventory_locations",
    "stock_balances",
    "inventory_operations",
    "inventory_movements",
    "receipts",
    "receipt_lines",
  ]) {
    denied(await publicClient().from(table).select("*"));
    denied(await s.adminA.from(table).delete().eq("id", randomUUID()));
    assert.deepEqual(checked(await s.leaderA.from(table).select("id"), table), []);
    assert.deepEqual(checked(await s.warehouseB.from(table).select("id"), table), []);
  }
  denied(await s.adminA.from("stock_balances").update({ quantity: 999 }).eq("lot_id", d.lot));
});
await verify(
  "recepții concurente distincte și stoc inițial păstrează zecimalele exacte",
  async () => {
    const lot = checked(
      await s.adminA
        .from("stock_lots")
        .select("id")
        .eq("product_id", d.decimal)
        .eq("substation_id", station)
        .single(),
      "Lot zecimal",
    ).id;
    const result = await Promise.all(
      ["1.125", "2.250"].map((quantity) =>
        s.warehouseA.rpc(
          "post_receipt",
          args({ p_initial: true, p_lines: [{ lot_id: lot, quantity }] }),
        ),
      ),
    );
    result.forEach((r) => checked(r, "Stoc inițial"));
    assert.equal(await balance(lot), 3.375);
    denied(
      await s.warehouseA.rpc(
        "post_receipt",
        args({ p_lines: [{ lot_id: lot, quantity: "0.0001" }] }),
      ),
    );
    denied(
      await s.warehouseA.rpc(
        "post_receipt",
        args({
          p_lines: [
            { lot_id: d.lot, quantity: "1" },
            { lot_id: d.lot, quantity: "2" },
          ],
        }),
      ),
    );
  },
);
await verify(
  "jurnalul se reconciliază cu fiecare sold și produsele inactive sunt refuzate",
  async () => {
    const movements = await rows("inventory_movements");
    for (const b of await rows("stock_balances")) {
      const expected = movements
        .filter((m) => m.lot_id === b.lot_id)
        .reduce(
          (sum, m) =>
            sum +
            (m.destination_id === b.location_id ? m.quantity : 0) -
            (m.source_id === b.location_id ? m.quantity : 0),
          0,
        );
      assert.equal(b.quantity, expected);
    }
    await rpc(s.adminA, "save_product", { ...d.medArgs, p_active: false });
    denied(await s.warehouseA.rpc("post_receipt", args()));
    await rpc(s.adminA, "save_product", d.medArgs);
  },
);
f.m05 = { receipt: first };
await writeFile(file, JSON.stringify(f, null, 2), { mode: 0o600 });
console.log(`${passed} grupuri de teste M05 trecute pe PostgreSQL/Supabase real.`);

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  checked,
  configuration,
  login,
  publicClient,
  privilegedClient,
} from "../../scripts/supabase-tools.mjs";

const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const fixture = JSON.parse(await readFile(file, "utf8"));
assert.equal(fixture.url, configuration().url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(fixture.url).hostname.split(".")[0]);
assert.equal(fixture.m04, undefined, "Fixturea M04 există deja.");
const s = {};
for (const name of [
  "adminA",
  "central",
  "manager",
  "warehouseA",
  "warehouseB",
  "leaderA",
  "foreignAdmin",
])
  s[name] = await login(fixture.accounts[name]);
const admin = privilegedClient();
const station = fixture.stations.A;
const rpc = async (client, name, args) => checked(await client.rpc(name, args), name);
const denied = (result) => assert.ok(result.error, "PostgreSQL trebuia să refuze cererea");
const rows = async (client, table) => checked(await client.from(table).select("*"), table);
const productArgs = (overrides = {}) => ({
  p_substation: station,
  p_product: null,
  p_code: randomUUID().slice(0, 12),
  p_name: "Produs fictiv M04",
  p_category: "consumable",
  p_base_unit: "buc",
  p_precision: 0,
  p_track_lots: false,
  p_track_expiry: false,
  p_active: true,
  p_reason: "Verificare catalog M04",
  ...overrides,
});
const data = {};
data.medArgs = productArgs({
  p_code: "M04-MED",
  p_name: "Medicament fictiv M04",
  p_category: "medication",
  p_base_unit: "fiola",
  p_track_lots: true,
  p_track_expiry: true,
});
data.med = await rpc(s.central, "save_product", data.medArgs);
data.medArgs.p_product = data.med;
data.simpleArgs = productArgs({ p_code: "M04-SIMPLE" });
data.simple = await rpc(s.adminA, "save_product", data.simpleArgs);
data.simpleArgs.p_product = data.simple;
data.decimalArgs = productArgs({ p_code: "M04-DECIMAL", p_base_unit: "l", p_precision: 3 });
data.decimal = await rpc(s.adminA, "save_product", data.decimalArgs);
data.decimalArgs.p_product = data.decimal;
data.foreign = await rpc(
  s.foreignAdmin,
  "save_product",
  productArgs({ p_substation: fixture.stations.Foreign }),
);
const local = (product, overrides = {}) => ({
  p_substation: station,
  p_product: product,
  p_minimum: "10",
  p_active: true,
  p_reason: "Prag local fictiv M04",
  ...overrides,
});
for (const product of [data.med, data.simple, data.decimal])
  await rpc(s.warehouseA, "save_station_product", local(product));
await rpc(
  s.warehouseB,
  "save_station_product",
  local(data.med, { p_substation: fixture.stations.B, p_minimum: "22" }),
);
data.lotArgs = {
  p_substation: station,
  p_product: data.med,
  p_lot_code: "TEST-LOT",
  p_expires_on: "2027-12-31",
  p_reason: "Lot fictiv de verificare M04",
};
data.lot = await rpc(s.warehouseA, "create_stock_lot", data.lotArgs);
data.internal = await rpc(s.warehouseA, "create_stock_lot", {
  ...data.lotArgs,
  p_product: data.simple,
  p_lot_code: null,
  p_expires_on: null,
});
data.lotB = await rpc(s.warehouseB, "create_stock_lot", {
  ...data.lotArgs,
  p_substation: fixture.stations.B,
});
fixture.m04 = data;
await writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
let passed = 0;
async function verify(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}

await verify("catalog comun instituțional, praguri și loturi izolate pe substație", async () => {
  assert.equal((await rows(s.warehouseA, "products")).length, 3);
  assert.equal((await rows(s.foreignAdmin, "products")).length, 1);
  assert.equal((await rows(s.warehouseA, "station_product_settings")).length, 3);
  assert.deepEqual(
    (await rows(s.warehouseB, "station_product_settings")).map((r) => r.minimum_quantity),
    [22],
  );
  assert.equal((await rows(s.warehouseA, "stock_lots")).length, 2);
  assert.equal((await rows(s.warehouseB, "stock_lots")).length, 1);
  for (const table of ["products", "station_product_settings", "stock_lots"])
    assert.deepEqual(await rows(s.leaderA, table), []);
  assert.deepEqual(
    checked(await s.warehouseA.from("stock_lots").select("id").eq("id", data.lotB), "Lot străin"),
    [],
  );
});
await verify("drepturi separate pentru catalogul comun și configurarea locală", async () => {
  for (const name of ["manager", "warehouseA", "leaderA"])
    denied(await s[name].rpc("save_product", data.medArgs));
  denied(await s.adminA.rpc("save_product", { ...data.medArgs, p_product: data.foreign }));
  denied(
    await s.warehouseA.rpc(
      "save_station_product",
      local(data.med, { p_substation: fixture.stations.B }),
    ),
  );
  denied(await s.adminA.rpc("save_station_product", local(data.foreign)));
  denied(await s.leaderA.rpc("create_stock_lot", { ...data.lotArgs, p_lot_code: "FORBIDDEN" }));
  denied(
    await s.warehouseA.rpc("set_stock_lot_blocked", {
      p_substation: station,
      p_lot: data.lotB,
      p_blocked: true,
      p_reason: "Lot străin M04",
    }),
  );
});
await verify("anon și scrierile directe nu pot ocoli validarea", async () => {
  for (const table of ["products", "station_product_settings", "stock_lots"]) {
    denied(await publicClient().from(table).select("*"));
    denied(await s.adminA.from(table).delete().eq("id", randomUUID()));
  }
  denied(await s.adminA.from("products").update({ active: false }).eq("id", data.med));
  denied(
    await s.adminA
      .from("station_product_settings")
      .update({ minimum_quantity: 999 })
      .eq("product_id", data.med),
  );
  denied(await s.adminA.from("stock_lots").update({ blocked: true }).eq("id", data.lot));
  denied(await publicClient().rpc("save_product", data.medArgs));
});
await verify(
  "câmpuri, categorii și unități indivizibile; metadatele istorice rămân valide",
  async () => {
    for (const invalid of [
      { p_code: "" },
      { p_name: "" },
      { p_category: "unknown" },
      { p_base_unit: "cutie" },
      { p_precision: 1 },
      { p_precision: 4 },
      { p_track_lots: false, p_track_expiry: true },
      { p_reason: "x" },
    ])
      denied(await s.adminA.rpc("save_product", productArgs(invalid)));
    for (const invalid of [{ p_lot_code: "" }, { p_expires_on: "2026-02-30" }])
      denied(await s.warehouseA.rpc("create_stock_lot", { ...data.lotArgs, ...invalid }));
    denied(await s.warehouseA.rpc("create_stock_lot", { ...data.lotArgs, p_product: data.simple }));
    assert.equal(
      (await rows(s.warehouseA, "stock_lots")).find((l) => l.id === data.internal).is_internal,
      true,
    );
  },
);
await verify(
  "pragurile sunt exacte, fără rotunjire sau fracții pe produse indivizibile",
  async () => {
    await rpc(s.manager, "save_station_product", local(data.decimal, { p_minimum: "12.125" }));
    assert.equal(
      (await rows(s.warehouseA, "station_product_settings")).find(
        (r) => r.product_id === data.decimal,
      ).minimum_quantity,
      12.125,
    );
    for (const n of ["-1", "NaN", "Infinity", "0.001", "1000000000"])
      denied(await s.warehouseA.rpc("save_station_product", local(data.simple, { p_minimum: n })));
    denied(
      await s.warehouseA.rpc("save_station_product", local(data.decimal, { p_minimum: "1.2345" })),
    );
    denied(await s.adminA.rpc("save_product", { ...data.decimalArgs, p_precision: 2 }));
  },
);
await verify("unitatea și identitatea lotului rămân fixe; eșecul anulează și auditul", async () => {
  const before = (await rows(s.adminA, "audit_events")).length;
  denied(
    await s.adminA.rpc("save_product", {
      ...data.medArgs,
      p_name: "Nu se salvează",
      p_base_unit: "comprimat",
    }),
  );
  denied(
    await s.adminA.rpc("save_product", { ...data.simpleArgs, p_precision: 1, p_base_unit: "l" }),
  );
  denied(await admin.from("stock_lots").update({ expires_on: "2029-12-31" }).eq("id", data.lot));
  denied(
    await admin.from("stock_lots").update({ substation_id: fixture.stations.B }).eq("id", data.lot),
  );
  assert.equal(
    (await rows(s.adminA, "products")).find((p) => p.id === data.med).name,
    data.medArgs.p_name,
  );
  assert.equal((await rows(s.adminA, "audit_events")).length, before);
});
await verify(
  "dezactivarea globală/locală oprește loturi noi, blocarea păstrează istoricul",
  async () => {
    await rpc(s.adminA, "save_product", { ...data.medArgs, p_active: false });
    denied(await s.warehouseA.rpc("create_stock_lot", { ...data.lotArgs, p_lot_code: "INACTIVE" }));
    await rpc(s.adminA, "save_product", data.medArgs);
    await rpc(s.warehouseA, "save_station_product", local(data.med, { p_active: false }));
    denied(await s.warehouseA.rpc("create_stock_lot", { ...data.lotArgs, p_lot_code: "INACTIVE" }));
    await rpc(s.warehouseA, "save_station_product", local(data.med));
    await rpc(s.manager, "set_stock_lot_blocked", {
      p_substation: station,
      p_lot: data.lot,
      p_blocked: true,
      p_reason: "Blocare lot fictiv M04",
    });
    assert.equal(
      (await rows(s.warehouseA, "stock_lots")).find((l) => l.id === data.lot).blocked,
      true,
    );
    await rpc(s.manager, "set_stock_lot_blocked", {
      p_substation: station,
      p_lot: data.lot,
      p_blocked: false,
      p_reason: "Restaurare lot fictiv M04",
    });
  },
);
await verify("concurența nu dublează codurile și lotul intern; pragul rămâne unic", async () => {
  for (const args of [productArgs({ p_code: "M04-RACE" })]) {
    const result = await Promise.all([0, 1].map(() => s.adminA.rpc("save_product", args)));
    assert.equal(result.filter((r) => !r.error).length, 1);
  }
  const result = await Promise.all(
    [0, 1].map(() => s.warehouseA.rpc("create_stock_lot", { ...data.lotArgs, p_lot_code: "RACE" })),
  );
  assert.equal(result.filter((r) => !r.error).length, 1);
  const internals = await Promise.all(
    [0, 1].map(() =>
      s.warehouseA.rpc("create_stock_lot", {
        ...data.lotArgs,
        p_product: data.decimal,
        p_lot_code: null,
        p_expires_on: null,
      }),
    ),
  );
  assert.equal(internals.filter((r) => !r.error).length, 1);
  const settings = await Promise.all(
    ["15", "16"].map((p_minimum) =>
      s.warehouseA.rpc("save_station_product", local(data.simple, { p_minimum })),
    ),
  );
  settings.forEach((r) => checked(r, "Concurență prag"));
  assert.equal(
    (await rows(s.warehouseA, "station_product_settings")).filter(
      (r) => r.product_id === data.simple,
    ).length,
    1,
  );
});
await verify("revocarea cu JWT existent și auditul local sunt respectate", async () => {
  await rpc(s.adminA, "set_account_access", {
    p_user: fixture.accounts.warehouseA.id,
    p_active: true,
    p_roles: [],
    p_reason: "Revocare test catalog M04",
  });
  denied(await s.warehouseA.rpc("save_station_product", local(data.med)));
  assert.deepEqual(await rows(s.warehouseA, "stock_lots"), []);
  await rpc(s.adminA, "set_account_access", {
    p_user: fixture.accounts.warehouseA.id,
    p_active: true,
    p_roles: [{ role: "warehouse", substation_id: station }],
    p_reason: "Restaurare test catalog M04",
  });
  const events = (await rows(s.adminA, "audit_events")).filter(
    (e) => e.entity_table === "stock_lots" && e.actor_id === fixture.accounts.manager.id,
  );
  assert.ok(
    events.some(
      (e) =>
        e.before_data.blocked === false && e.after_data.blocked === true && e.reason.length >= 5,
    ),
  );
});
console.log(`${passed} grupuri de teste M04 trecute pe PostgreSQL/Supabase real.`);

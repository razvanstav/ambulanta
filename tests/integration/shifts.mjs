import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  checked,
  configuration,
  login,
  privilegedClient,
  createAuthAccount,
  publicClient,
} from "../../scripts/supabase-tools.mjs";
const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const f = JSON.parse(await readFile(file, "utf8"));
assert.equal(f.url, configuration().url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(f.url).hostname.split(".")[0]);
assert.equal(f.m06, undefined);
const station = f.stations.A;
const s = {
  admin: await login(f.accounts.adminA),
  warehouse: await login(f.accounts.warehouseA),
  manager: await login(f.accounts.manager),
  foreign: await login(f.accounts.warehouseB),
};
const privileged = privilegedClient();
const d = { people: {}, vehicles: {} };
const save = async () => writeFile(file, JSON.stringify(f, null, 2), { mode: 0o600 });
const rpc = async (c, n, a) => checked(await c.rpc(n, a), n);
const denied = (r) => assert.ok(r.error, "Cererea trebuia refuzată de PostgreSQL");
for (const name of ["m06a", "m06b", "m06c", "m06d", "m06uiDesktop", "m06uiMobile"]) {
  const account = await createAuthAccount(privileged, `${name}.${f.run}@example.invalid`, {
    m02_fixture: f.run,
  });
  f.accounts[name] = account;
  await save();
  await rpc(s.admin, "register_account", {
    p_user: account.id,
    p_name: name,
    p_reason: "Cont fictiv M06",
  });
  await rpc(s.admin, "set_account_access", {
    p_user: account.id,
    p_active: true,
    p_roles: [{ role: "shift_leader", substation_id: station }],
    p_reason: "Titular fictiv M06",
  });
  const args = {
    p_substation: station,
    p_employee: null,
    p_code: name.toUpperCase(),
    p_name: name,
    p_job_title: "Asistent test",
    p_active: true,
    p_is_titular: true,
    p_account: account.id,
    p_reason: "Personal fictiv M06",
  };
  args.p_employee = await rpc(s.admin, "save_employee", args);
  d.people[name] = args;
  d.vehicles[name] = await rpc(s.admin, "save_vehicle", {
    p_substation: station,
    p_vehicle: null,
    p_identifier: `AMB-${name}`,
    p_description: "Mașină fictivă M06",
    p_active: true,
    p_operational: true,
    p_reason: "Mașină test M06",
  });
  s[name] = await login(account);
}
f.m06 = d;
await save();
const rows = async (c, table) => checked(await c.from(table).select("*"), table);
const requestArgs = (name, extra = {}) => ({
  p_substation: station,
  p_vehicle: d.vehicles[name],
  p_request_key: randomUUID(),
  p_planned_start: "2026-09-10T00:00",
  p_planned_end: "2099-09-10T12:00",
  ...extra,
});
const request = async (name, extra = {}) => rpc(s[name], "request_shift", requestArgs(name, extra));
const cancel = async (id) =>
  rpc(s.warehouse, "cancel_shift", { p_shift: id, p_reason: "Anulare cerere de test M06" });
const sheetArgs = (shift, quantity = "10", extra = {}) => ({
  p_shift: shift,
  p_expected_sheet: null,
  p_request_key: randomUUID(),
  p_send: true,
  p_lines: [{ lot_id: f.m04.lot, quantity }],
  p_reason: "Fișă fictivă de verificare M06",
  ...extra,
});
const sheet = async (shift, quantity = "10", extra = {}) =>
  rpc(s.warehouse, "save_issue_sheet", sheetArgs(shift, quantity, extra));
const accept = async (name, id, key = randomUUID()) =>
  rpc(s[name], "accept_issue_sheet", { p_sheet: id, p_request_key: key });
const balances = async () => {
  const locations = await rows(s.admin, "inventory_locations");
  const warehouse = locations.find((l) => l.substation_id === station && l.kind === "warehouse").id;
  const all = (await rows(s.admin, "stock_balances")).filter((b) => b.lot_id === f.m04.lot);
  return {
    warehouse: all.find((b) => b.location_id === warehouse)?.quantity ?? 0,
    inShifts: all.filter((b) => b.location_id !== warehouse).reduce((a, b) => a + b.quantity, 0),
  };
};
let passed = 0;
async function verify(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
await verify(
  "două cereri concurente rezervă o singură mașină și anularea o eliberează",
  async () => {
    const results = await Promise.all(
      ["m06a", "m06b"].map((name) =>
        s[name].rpc("request_shift", requestArgs(name, { p_vehicle: d.vehicles.m06a })),
      ),
    );
    assert.equal(results.filter((r) => !r.error).length, 1);
    const winner = results.find((r) => !r.error).data;
    assert.ok(
      !(await rpc(s.m06a, "list_available_vehicles", { p_substation: station })).some(
        (v) => v.id === d.vehicles.m06a,
      ),
    );
    await cancel(winner);
    assert.ok(
      (await rpc(s.m06a, "list_available_vehicles", { p_substation: station })).some(
        (v) => v.id === d.vehicles.m06a,
      ),
    );
  },
);
await verify("cererea idempotentă și eligibilitatea, inclusiv cont/rol revocat", async () => {
  const args = requestArgs("m06a");
  const a = await rpc(s.m06a, "request_shift", args);
  assert.equal(await rpc(s.m06a, "request_shift", args), a);
  denied(await s.m06a.rpc("request_shift", { ...args, p_vehicle: d.vehicles.m06b }));
  denied(await s.m06a.rpc("request_shift", requestArgs("m06a", { p_vehicle: d.vehicles.m06b })));
  await cancel(a);
  await rpc(s.admin, "save_employee", { ...d.people.m06a, p_is_titular: false });
  denied(await s.m06a.rpc("request_shift", requestArgs("m06a")));
  await rpc(s.admin, "save_employee", d.people.m06a);
  for (const [active, roles] of [
    [false, [{ role: "shift_leader", substation_id: station }]],
    [true, []],
  ]) {
    await rpc(s.admin, "set_account_access", {
      p_user: f.accounts.m06a.id,
      p_active: active,
      p_roles: roles,
      p_reason: "Revocare test M06",
    });
    denied(await s.m06a.rpc("request_shift", requestArgs("m06a")));
  }
  await rpc(s.admin, "set_account_access", {
    p_user: f.accounts.m06a.id,
    p_active: true,
    p_roles: [{ role: "shift_leader", substation_id: station }],
    p_reason: "Restaurare test M06",
  });
});
await verify(
  "ciorna și trimiterea păstrează 100 în depozit; izolarea fișelor proprii",
  async () => {
    d.shiftA = await request("m06a");
    const draft = await sheet(d.shiftA, "10", { p_send: false });
    assert.equal(
      (await rows(s.m06a, "issue_sheet_versions")).filter((v) => v.shift_id === d.shiftA).length,
      0,
    );
    d.sheetA = await sheet(d.shiftA, "10", { p_expected_sheet: draft });
    assert.deepEqual(await balances(), { warehouse: 100, inShifts: 0 });
    for (const table of [
      "shifts",
      "issue_sheet_versions",
      "issue_sheet_lines",
      "issue_sheet_acceptances",
      "stock_balances",
      "inventory_movements",
    ]) {
      const other = await rows(s.m06b, table);
      assert.ok(
        !other.some((r) => r.id === d.shiftA || r.id === d.sheetA || r.sheet_id === d.sheetA),
      );
      denied(await s.m06a.from(table).delete().eq("id", randomUUID()));
      denied(await publicClient().from(table).select("*"));
    }
    denied(
      await s.m06b.rpc("accept_issue_sheet", { p_sheet: d.sheetA, p_request_key: randomUUID() }),
    );
    denied(
      await s.warehouse.rpc("accept_issue_sheet", {
        p_sheet: d.sheetA,
        p_request_key: randomUUID(),
      }),
    );
    denied(await s.foreign.rpc("save_issue_sheet", sheetArgs(d.shiftA)));
    denied(await s.manager.rpc("save_issue_sheet", sheetArgs(d.shiftA)));
  },
);
await verify("acceptarea atomică produce 90/10, replay cu altă cheie nu dublează", async () => {
  const result = await Promise.all(
    [0, 1].map(() =>
      s.m06a.rpc("accept_issue_sheet", { p_sheet: d.sheetA, p_request_key: randomUUID() }),
    ),
  );
  result.forEach((r) => checked(r, "Acceptare concurentă"));
  assert.equal(result[0].data, result[1].data);
  assert.deepEqual(await balances(), { warehouse: 90, inShifts: 10 });
  assert.equal(await accept("m06a", d.sheetA), result[0].data);
  const current = (await rows(s.m06a, "shifts")).find((r) => r.id === d.shiftA);
  assert.equal(current.state, "open");
  assert.ok(current.started_at && current.operational_date);
  d.started = current.started_at;
  assert.equal(
    (await rpc(s.m06a, "list_vehicle_stock", { p_substation: station, p_vehicle: d.vehicles.m06a }))
      .filter((b) => b.lot_id === f.m04.lot)
      .reduce((a, b) => a + b.quantity, 0),
    10,
  );
  assert.equal(
    (await rows(s.m06a, "inventory_operations")).filter((o) => o.id === result[0].data).length,
    1,
  );
  assert.equal((await rows(s.m06b, "stock_balances")).length, 0);
  denied(
    await s.m06a.rpc("cancel_shift", {
      p_shift: d.shiftA,
      p_reason: "Anulare după predare interzisă",
    }),
  );
});
await verify("suplimentarea păstrează momentul, mașina și tura", async () => {
  const supplement = await sheet(d.shiftA, "5");
  await accept("m06a", supplement);
  assert.deepEqual(await balances(), { warehouse: 85, inShifts: 15 });
  const current = (await rows(s.m06a, "shifts")).find((r) => r.id === d.shiftA);
  assert.equal(current.started_at, d.started);
  assert.equal(current.vehicle_id, d.vehicles.m06a);
});
await verify("fișa veche, neconcordanța și retragerea nu pot fi acceptate", async () => {
  const shift = await request("m06b");
  const original = await sheet(shift);
  await rpc(s.m06b, "change_issue_sheet", {
    p_sheet: original,
    p_action: "dispute",
    p_reason: "Cantitate neconcordantă fictivă",
  });
  denied(
    await s.m06b.rpc("accept_issue_sheet", { p_sheet: original, p_request_key: randomUUID() }),
  );
  const replacement = await sheet(shift, "8", { p_expected_sheet: original });
  denied(
    await s.m06b.rpc("accept_issue_sheet", { p_sheet: original, p_request_key: randomUUID() }),
  );
  await rpc(s.warehouse, "change_issue_sheet", {
    p_sheet: replacement,
    p_action: "withdraw",
    p_reason: "Retragere fișă test M06",
  });
  denied(
    await s.m06b.rpc("accept_issue_sheet", { p_sheet: replacement, p_request_key: randomUUID() }),
  );
  await cancel(shift);
});
await verify("acceptarea reverifică eligibilitatea și disponibilitatea mașinii", async () => {
  const shift = await request("m06b");
  const pending = await sheet(shift);
  await rpc(s.admin, "save_employee", { ...d.people.m06b, p_active: false });
  denied(await s.m06b.rpc("accept_issue_sheet", { p_sheet: pending, p_request_key: randomUUID() }));
  await rpc(s.admin, "save_employee", d.people.m06b);
  await rpc(s.admin, "save_vehicle", {
    p_substation: station,
    p_vehicle: d.vehicles.m06b,
    p_identifier: "AMB-M06B",
    p_description: "Mașină fictivă M06",
    p_active: true,
    p_operational: false,
    p_reason: "Test indisponibilitate M06",
  });
  denied(await s.m06b.rpc("accept_issue_sheet", { p_sheet: pending, p_request_key: randomUUID() }));
  await rpc(s.admin, "save_vehicle", {
    p_substation: station,
    p_vehicle: d.vehicles.m06b,
    p_identifier: "AMB-M06B",
    p_description: "Mașină fictivă M06",
    p_active: true,
    p_operational: true,
    p_reason: "Restaurare disponibilitate M06",
  });
  assert.deepEqual(await balances(), { warehouse: 85, inShifts: 15 });
  await cancel(shift);
});
await verify(
  "două acceptări distincte nu consumă același disponibil; rollback complet",
  async () => {
    const b = await request("m06b");
    const c = await request("m06c");
    const sb = await sheet(b, "60");
    const sc = await sheet(c, "60");
    const before = (await rows(s.admin, "issue_sheet_acceptances")).length;
    const result = await Promise.all(
      [
        ["m06b", sb],
        ["m06c", sc],
      ].map(([name, id]) =>
        s[name].rpc("accept_issue_sheet", { p_sheet: id, p_request_key: randomUUID() }),
      ),
    );
    assert.equal(result.filter((r) => !r.error).length, 1);
    assert.equal((await rows(s.admin, "issue_sheet_acceptances")).length, before + 1);
    assert.deepEqual(await balances(), { warehouse: 25, inShifts: 75 });
    const loser = result[0].error ? b : c;
    d.freeName = result[0].error ? "m06b" : "m06c";
    assert.equal((await rows(s.admin, "shifts")).find((r) => r.id === loser).started_at, null);
    await cancel(loser);
  },
);
await verify("înlocuirea și acceptarea concurente au o singură tranziție validă", async () => {
  const name = d.freeName;
  const shift = await request(name);
  const pending = await sheet(shift, "1");
  const results = await Promise.all([
    s[name].rpc("accept_issue_sheet", { p_sheet: pending, p_request_key: randomUUID() }),
    s.warehouse.rpc("save_issue_sheet", sheetArgs(shift, "2", { p_expected_sheet: pending })),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  if (results[0].error) await cancel(shift);
});
await verify("anularea și acceptarea concurente nu lasă o tură anulată cu stoc", async () => {
  const shift = await request("m06d");
  const pending = await sheet(shift, "1");
  const result = await Promise.all([
    s.m06d.rpc("accept_issue_sheet", { p_sheet: pending, p_request_key: randomUUID() }),
    s.warehouse.rpc("cancel_shift", { p_shift: shift, p_reason: "Anulare concurentă M06" }),
  ]);
  assert.equal(result.filter((r) => !r.error).length, 1);
  const current = (await rows(s.admin, "shifts")).find((r) => r.id === shift);
  assert.ok(["cancelled", "open"].includes(current.state));
  assert.equal(
    (await rows(s.admin, "issue_sheet_acceptances")).filter((a) => a.sheet_id === pending).length,
    current.state === "open" ? 1 : 0,
  );
});
await verify(
  "soldurile de depozit și tură se reconciliază cu jurnalul, fără editări directe",
  async () => {
    const movements = await rows(s.admin, "inventory_movements");
    for (const balance of await rows(s.admin, "stock_balances")) {
      const expected = movements
        .filter((m) => m.lot_id === balance.lot_id)
        .reduce(
          (sum, m) =>
            sum +
            (m.destination_id === balance.location_id ? m.quantity : 0) -
            (m.source_id === balance.location_id ? m.quantity : 0),
          0,
        );
      assert.equal(balance.quantity, expected);
      assert.ok(balance.quantity >= 0);
    }
    denied(
      await s.admin.from("issue_sheet_lines").update({ quantity: 999 }).eq("sheet_id", d.sheetA),
    );
    denied(
      await s.admin.from("shifts").update({ owner_id: f.accounts.m06b.id }).eq("id", d.shiftA),
    );
  },
);
await save();
console.log(`${passed} grupuri de teste M06 trecute pe PostgreSQL/Supabase real.`);

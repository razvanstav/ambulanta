import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { checked, configuration, login, publicClient } from "../../scripts/supabase-tools.mjs";

const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const fixture = JSON.parse(await readFile(file, "utf8"));
const { url } = configuration();
assert.equal(fixture.url, url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(url).hostname.split(".")[0]);
assert.equal(fixture.m03, undefined, "Fixturea M03 există deja; curăță înaintea unei noi rulări.");
const sessions = {};
for (const name of [
  "adminA",
  "warehouseA",
  "warehouseB",
  "leaderA",
  "leaderB",
  "manager",
  "central",
  "foreignAdmin",
])
  sessions[name] = await login(fixture.accounts[name]);
const station = fixture.stations.A;
const data = {};
async function rpc(client, name, args) {
  return checked(await client.rpc(name, args), name);
}
function employeeArgs(overrides = {}) {
  return {
    p_substation: station,
    p_employee: null,
    p_code: randomUUID().slice(0, 12),
    p_name: "Angajat Test M03",
    p_job_title: "Asistent test",
    p_active: true,
    p_is_titular: false,
    p_account: null,
    p_reason: "Verificare M03 personal",
    ...overrides,
  };
}
function vehicleArgs(overrides = {}) {
  return {
    p_substation: station,
    p_vehicle: null,
    p_identifier: randomUUID().slice(0, 12),
    p_description: "Ambulanță fictivă M03",
    p_active: true,
    p_operational: true,
    p_reason: "Verificare M03 flotă",
    ...overrides,
  };
}
data.holderArgs = employeeArgs({
  p_code: "M03-HOLDER-A",
  p_name: "Titular Test A",
  p_is_titular: true,
  p_account: fixture.accounts.leaderA.id,
});
data.holderA = await rpc(sessions.adminA, "save_employee", data.holderArgs);
data.holderArgs.p_employee = data.holderA;
data.holderB = await rpc(
  sessions.adminA,
  "save_employee",
  employeeArgs({
    p_code: "M03-HOLDER-B",
    p_name: "Titular Test B",
    p_is_titular: true,
    p_account: fixture.accounts.leaderB.id,
  }),
);
data.simpleArgs = employeeArgs({ p_code: "M03-SIMPLE", p_name: "Angajat simplu Test" });
data.simple = await rpc(sessions.adminA, "save_employee", data.simpleArgs);
data.simpleArgs.p_employee = data.simple;
data.unlinked = await rpc(
  sessions.adminA,
  "save_employee",
  employeeArgs({ p_code: "M03-UNLINKED", p_name: "Titular fără cont", p_is_titular: true }),
);
data.otherStation = await rpc(
  sessions.adminA,
  "save_employee",
  employeeArgs({ p_substation: fixture.stations.B, p_code: "M03-OTHER", p_name: "Angajat din B" }),
);
data.foreign = await rpc(
  sessions.foreignAdmin,
  "save_employee",
  employeeArgs({
    p_substation: fixture.stations.Foreign,
    p_code: "M03-FOREIGN",
    p_name: "Angajat instituția B",
  }),
);
data.vehicleArgs = vehicleArgs({ p_identifier: "M03-READY" });
data.ready = await rpc(sessions.adminA, "save_vehicle", data.vehicleArgs);
data.vehicleArgs.p_vehicle = data.ready;
data.inactive = await rpc(
  sessions.adminA,
  "save_vehicle",
  vehicleArgs({ p_identifier: "M03-INACTIVE", p_active: false }),
);
data.unfit = await rpc(
  sessions.adminA,
  "save_vehicle",
  vehicleArgs({ p_identifier: "M03-UNFIT", p_operational: false }),
);
data.vehicleB = await rpc(
  sessions.adminA,
  "save_vehicle",
  vehicleArgs({ p_substation: fixture.stations.B, p_identifier: "M03-B" }),
);
data.foreignVehicle = await rpc(
  sessions.foreignAdmin,
  "save_vehicle",
  vehicleArgs({ p_substation: fixture.stations.Foreign, p_identifier: "M03-FOREIGN" }),
);
fixture.m03 = data;
await writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
async function rows(client, table) {
  return checked(await client.from(table).select("*"), table);
}
async function eligible(client) {
  return rpc(client, "list_eligible_holders", { p_substation: station });
}
async function own() {
  return rpc(sessions.leaderA, "resolve_my_holder", { p_substation: station });
}
async function denied(result) {
  assert.ok(result.error, "Operația trebuia refuzată de PostgreSQL");
}
let passed = 0;
async function verify(name, fn) {
  await fn();
  passed++;
  console.log(`PASS M03 ${name}`);
}

await verify(
  "RLS limitează personalul și flota la substație/instituție; titularul vede numai persoana proprie",
  async () => {
    const localEmployees = await rows(sessions.warehouseA, "employees");
    assert.equal(localEmployees.length, 4);
    assert.ok(!localEmployees.some((row) => [data.otherStation, data.foreign].includes(row.id)));
    assert.deepEqual(
      (await rows(sessions.warehouseB, "employees")).map((row) => row.id),
      [data.otherStation],
    );
    assert.equal((await rows(sessions.central, "employees")).length, 5);
    assert.deepEqual(
      (await rows(sessions.leaderA, "employees")).map((row) => row.id),
      [data.holderA],
    );
    assert.equal((await rows(sessions.leaderA, "employee_assignments")).length, 1);
    assert.deepEqual(
      (await rows(sessions.leaderA, "vehicles")).map((row) => row.id),
      [data.ready],
    );
    assert.deepEqual(
      checked(
        await sessions.warehouseA.from("employees").select("id").eq("id", data.otherStation),
        "Angajat ID străin",
      ),
      [],
    );
    assert.deepEqual(
      checked(
        await sessions.leaderA.from("vehicles").select("id").eq("id", data.vehicleB),
        "Mașină ID străin",
      ),
      [],
    );
  },
);
await verify(
  "eligibilitatea cere activ, titular, cont activ și rol; identitatea nu se alege din cerere",
  async () => {
    assert.equal((await eligible(sessions.adminA)).length, 2);
    assert.deepEqual(
      (await eligible(sessions.leaderA)).map((row) => row.employee_id),
      [data.holderA],
    );
    assert.deepEqual(
      (await own()).map((row) => row.employee_id),
      [data.holderA],
    );
    assert.deepEqual(
      await rpc(sessions.leaderA, "resolve_my_holder", { p_substation: fixture.stations.B }),
      [],
    );
    await rpc(sessions.manager, "save_employee", { ...data.holderArgs, p_is_titular: false });
    assert.deepEqual(await own(), []);
    // Historical own-record access is preserved when eligibility for NEW handovers is removed.
    assert.equal(
      await rpc(sessions.leaderA, "can_access_owned_record", {
        p_substation: station,
        p_owner: fixture.accounts.leaderA.id,
      }),
      true,
    );
    await rpc(sessions.manager, "save_employee", { ...data.holderArgs, p_active: false });
    assert.deepEqual(await own(), []);
    await rpc(sessions.manager, "save_employee", data.holderArgs);
    await rpc(sessions.manager, "save_employee", { ...data.simpleArgs, p_is_titular: true });
    assert.equal(
      (await eligible(sessions.adminA)).length,
      2,
      "Titularul fără cont nu devine eligibil",
    );
    await rpc(sessions.manager, "save_employee", data.simpleArgs);
    for (const [active, roles] of [
      [false, [{ role: "shift_leader", substation_id: station }]],
      [true, []],
    ]) {
      await rpc(sessions.adminA, "set_account_access", {
        p_user: fixture.accounts.leaderA.id,
        p_active: active,
        p_roles: roles,
        p_reason: "Test revocare eligibilitate M03",
      });
      assert.deepEqual(await own(), []);
    }
    await rpc(sessions.adminA, "set_account_access", {
      p_user: fixture.accounts.leaderA.id,
      p_active: true,
      p_roles: [{ role: "shift_leader", substation_id: station }],
      p_reason: "Restaurare fixture M03",
    });
    assert.equal((await own()).length, 1);
  },
);
await verify(
  "numai șeful local/adminul schimbă titularii și flota; asocierea contului cere administrator",
  async () => {
    for (const name of ["warehouseA", "leaderA", "central"]) {
      await denied(
        await sessions[name].rpc("save_employee", { ...data.holderArgs, p_is_titular: false }),
      );
      await denied(
        await sessions[name].rpc("save_vehicle", { ...data.vehicleArgs, p_operational: false }),
      );
    }
    await denied(
      await sessions.manager.rpc("save_employee", {
        ...data.simpleArgs,
        p_account: fixture.accounts.noRole.id,
      }),
    );
    await denied(
      await sessions.manager.rpc("save_employee", {
        ...data.holderArgs,
        p_substation: fixture.stations.B,
      }),
    );
    await denied(
      await sessions.adminA.rpc("save_employee", { ...data.holderArgs, p_employee: data.foreign }),
    );
    await denied(
      await sessions.adminA.rpc("save_vehicle", {
        ...data.vehicleArgs,
        p_vehicle: data.foreignVehicle,
      }),
    );
    await denied(
      await sessions.manager.rpc("save_vehicle", { ...data.vehicleArgs, p_vehicle: data.vehicleB }),
    );
  },
);
await verify("cheile anonime și scrierile directe sunt refuzate", async () => {
  for (const table of ["employees", "employee_assignments", "vehicles"])
    await denied(await publicClient().from(table).select("*"));
  await denied(await publicClient().rpc("save_employee", data.holderArgs));
  await denied(
    await sessions.adminA
      .from("employees")
      .update({ user_id: fixture.accounts.noRole.id })
      .eq("id", data.holderA),
  );
  await denied(
    await sessions.adminA
      .from("employee_assignments")
      .update({ is_titular: true })
      .eq("employee_id", data.simple),
  );
  await denied(
    await sessions.adminA.from("vehicles").update({ active: false }).eq("id", data.ready),
  );
});
await verify("mașinile inactive și inapte dispar din selecția titularului", async () => {
  await rpc(sessions.manager, "save_vehicle", { ...data.vehicleArgs, p_operational: false });
  assert.deepEqual(await rows(sessions.leaderA, "vehicles"), []);
  assert.equal((await rows(sessions.warehouseA, "vehicles")).length, 3);
  await rpc(sessions.manager, "save_vehicle", { ...data.vehicleArgs, p_active: false });
  assert.deepEqual(await rows(sessions.leaderA, "vehicles"), []);
  await rpc(sessions.manager, "save_vehicle", data.vehicleArgs);
  assert.deepEqual(
    (await rows(sessions.leaderA, "vehicles")).map((row) => row.id),
    [data.ready],
  );
});
await verify("erorile de apartenență/cont anulează și identitatea, și auditul", async () => {
  const before = await rows(sessions.adminA, "audit_events");
  await denied(
    await sessions.adminA.rpc("save_employee", {
      ...data.holderArgs,
      p_name: "Nume parțial interzis",
      p_job_title: "",
    }),
  );
  await denied(
    await sessions.adminA.rpc("save_employee", {
      ...data.holderArgs,
      p_account: fixture.accounts.foreignAdmin.id,
    }),
  );
  const person = checked(
    await sessions.adminA
      .from("employees")
      .select("display_name,user_id")
      .eq("id", data.holderA)
      .single(),
    "Rollback identitate",
  );
  assert.equal(person.display_name, data.holderArgs.p_name);
  assert.equal(person.user_id, data.holderArgs.p_account);
  assert.equal((await rows(sessions.adminA, "audit_events")).length, before.length);
});
await verify("asocierea concurentă nu permite două persoane pentru același cont", async () => {
  const attempts = await Promise.all(
    [0, 1].map(() =>
      sessions.adminA.rpc("save_employee", employeeArgs({ p_account: fixture.accounts.noRole.id })),
    ),
  );
  assert.equal(attempts.filter((result) => !result.error).length, 1);
  const linked = checked(
    await sessions.adminA.from("employees").select("id").eq("user_id", fixture.accounts.noRole.id),
    "Unicitate persoană/cont",
  );
  assert.equal(linked.length, 1);
  const vehicles = await Promise.all(
    [0, 1].map(() =>
      sessions.adminA.rpc("save_vehicle", vehicleArgs({ p_identifier: "M03-SAME" })),
    ),
  );
  assert.equal(vehicles.filter((result) => !result.error).length, 1);
});
await verify(
  "auditul păstrează autorul local și înainte/după pentru titular și flotă",
  async () => {
    const events = checked(
      await sessions.adminA
        .from("audit_events")
        .select("entity_table,before_data,after_data,reason")
        .eq("actor_id", fixture.accounts.manager.id)
        .eq("action", "UPDATE"),
      "Audit M03",
    );
    assert.ok(
      events.some(
        (event) =>
          event.entity_table === "employee_assignments" &&
          event.before_data.is_titular &&
          !event.after_data.is_titular,
      ),
    );
    assert.ok(
      events.some(
        (event) =>
          event.entity_table === "vehicles" &&
          event.before_data.operational &&
          !event.after_data.operational,
      ),
    );
    assert.ok(events.every((event) => event.reason.length >= 5));
  },
);
console.log(`${passed} grupuri de teste M03 trecute pe PostgreSQL/Supabase real.`);

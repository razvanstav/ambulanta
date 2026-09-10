import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import {
  checked,
  configuration,
  createAuthAccount,
  login,
  privilegedClient,
  publicClient,
} from "../../scripts/supabase-tools.mjs";

const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
try {
  await access(file);
  throw new Error(
    "Fixture M02 existentă. Rulează npm run test:integration:cleanup înainte de o nouă rulare.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const { url } = configuration();
if (process.env.M02_TEST_PROJECT_REF !== new URL(url).hostname.split(".")[0])
  throw new Error(
    "Setează M02_TEST_PROJECT_REF la proiectul demo de test, explicit. Nu rula pe date operaționale.",
  );
const run = randomUUID();
const admin = privilegedClient();
const fixture = { url, run, accounts: {}, institutions: [], stations: {} };
await mkdir(new URL("../../.verification/", import.meta.url), { recursive: true });
async function persist() {
  await writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
}
await persist();
const sessions = {};
async function account(name) {
  const value = await createAuthAccount(admin, `${name}.${run}@example.invalid`, {
    m02_fixture: run,
  });
  fixture.accounts[name] = value;
  await persist();
  sessions[name] = await login(value);
  return value;
}
async function rpc(client, name, values) {
  return checked(await client.rpc(name, values), name);
}
async function grant(actor, name, roles, active = true) {
  return rpc(sessions[actor], "set_account_access", {
    p_user: fixture.accounts[name].id,
    p_active: active,
    p_roles: roles,
    p_reason: "Verificare automată M02",
  });
}
function local(role, station) {
  return { role, substation_id: station };
}
const globalAdmin = [local("administrator", null)];
const a = await account("adminA");
const institutionA = await rpc(admin, "bootstrap_institution", {
  p_admin: a.id,
  p_name: `M02 test ${run} A`,
  p_admin_name: "Administrator Test A",
});
fixture.institutions.push(institutionA);
await persist();
const foreign = await account("foreignAdmin");
const institutionB = await rpc(admin, "bootstrap_institution", {
  p_admin: foreign.id,
  p_name: `M02 test ${run} B`,
  p_admin_name: "Administrator Test B",
});
fixture.institutions.push(institutionB);
await persist();
for (const name of [
  "adminB",
  "warehouseA",
  "warehouseB",
  "leaderA",
  "leaderB",
  "central",
  "manager",
  "noRole",
]) {
  const value = await account(name);
  await rpc(sessions.adminA, "register_account", {
    p_user: value.id,
    p_name: `Test ${name}`,
    p_reason: "Configurare fixture M02",
  });
}
for (const [name, actor] of [
  ["A", "adminA"],
  ["B", "adminA"],
  ["Foreign", "foreignAdmin"],
]) {
  fixture.stations[name] = await rpc(sessions[actor], "save_substation", {
    p_id: null,
    p_name: `Verificare ${name}`,
    p_active: true,
    p_reason: "Configurare fixture M02",
  });
  await persist();
}
const stationA = fixture.stations.A;
const stationB = fixture.stations.B;
const foreignStation = fixture.stations.Foreign;
await grant("adminA", "adminB", globalAdmin);
await grant("adminA", "warehouseA", [local("warehouse", stationA)]);
await grant("adminA", "warehouseB", [local("warehouse", stationB)]);
await grant("adminA", "leaderA", [local("shift_leader", stationA)]);
await grant("adminA", "leaderB", [local("shift_leader", stationA)]);
await grant("adminA", "central", [local("logistics", null)]);
await grant("adminA", "manager", [local("station_manager", stationA)]);

let passed = 0;
async function verify(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function denied(result) {
  assert.ok(result.error, "Cererea trebuia refuzată de PostgreSQL");
}
async function ids(client, table) {
  return checked(await client.from(table).select("id"), table)
    .map((row) => row.id)
    .sort();
}

await verify("anon nu citește tabele și nu execută operații administrative", async () => {
  const anon = publicClient();
  for (const table of [
    "institutions",
    "profiles",
    "substations",
    "role_assignments",
    "audit_events",
  ])
    await denied(await anon.from(table).select("*"));
  await denied(
    await anon.rpc("bootstrap_institution", {
      p_admin: a.id,
      p_name: "Atac",
      p_admin_name: "Atac",
    }),
  );
  await denied(
    await anon.rpc("save_substation", {
      p_id: null,
      p_name: "Atac",
      p_active: true,
      p_reason: "Test refuz",
    }),
  );
});
await verify("RLS izolează substațiile și instituțiile", async () => {
  assert.deepEqual(await ids(sessions.warehouseA, "substations"), [stationA]);
  assert.deepEqual(await ids(sessions.warehouseB, "substations"), [stationB]);
  assert.deepEqual(await ids(sessions.leaderA, "profiles"), [fixture.accounts.leaderA.id]);
  assert.deepEqual(await ids(sessions.central, "substations"), [stationA, stationB].sort());
  assert.deepEqual(await ids(sessions.adminA, "substations"), [stationA, stationB].sort());
  assert.deepEqual(await ids(sessions.foreignAdmin, "substations"), [foreignStation]);
  assert.deepEqual(
    checked(
      await sessions.warehouseA.from("substations").select("*").eq("id", stationB),
      "URL/API falsificat",
    ),
    [],
  );
  assert.deepEqual(await ids(sessions.noRole, "substations"), []);
});
await verify("contractul șefului de tură permite doar proprietarul propriu", async () => {
  for (const owner of ["leaderA", "leaderB"])
    assert.equal(
      await rpc(sessions.leaderA, "can_access_owned_record", {
        p_substation: stationA,
        p_owner: fixture.accounts[owner].id,
      }),
      owner === "leaderA",
    );
  assert.equal(
    await rpc(sessions.leaderA, "can_access_owned_record", {
      p_substation: stationB,
      p_owner: fixture.accounts.leaderA.id,
    }),
    false,
  );
  assert.equal(
    await rpc(sessions.central, "can_access_owned_record", {
      p_substation: stationB,
      p_owner: fixture.accounts.leaderA.id,
    }),
    true,
  );
  assert.equal(
    await rpc(sessions.central, "can_access_owned_record", {
      p_substation: foreignStation,
      p_owner: foreign.id,
    }),
    false,
  );
});
await verify("niciun rol neadministrativ nu își poate acorda rol global", async () => {
  for (const name of ["warehouseA", "leaderA", "manager", "central", "noRole"]) {
    await denied(
      await sessions[name].rpc("set_account_access", {
        p_user: fixture.accounts[name].id,
        p_active: true,
        p_roles: globalAdmin,
        p_reason: "Tentativă escaladare",
      }),
    );
    await denied(
      await sessions[name].rpc("save_substation", {
        p_id: stationA,
        p_name: "Atac",
        p_active: false,
        p_reason: "Tentativă escaladare",
      }),
    );
    await denied(
      await sessions[name].rpc("register_account", {
        p_user: foreign.id,
        p_name: "Atac",
        p_reason: "Tentativă escaladare",
      }),
    );
  }
  checked(
    await sessions.noRole.auth.updateUser({
      data: { role: "administrator", institution_id: institutionA },
    }),
    "Metadate declarate",
  );
  assert.deepEqual(await ids(sessions.noRole, "substations"), []);
});
await verify(
  "scrierile directe și rescrierea auditului sunt interzise inclusiv administratorului",
  async () => {
    await denied(
      await sessions.adminA.from("substations").update({ active: false }).eq("id", stationA),
    );
    await denied(
      await sessions.adminA.from("role_assignments").insert({
        institution_id: institutionA,
        user_id: fixture.accounts.noRole.id,
        role: "administrator",
      }),
    );
    await denied(await sessions.adminA.from("profiles").update({ active: false }).eq("id", a.id));
    await denied(
      await sessions.adminA.from("audit_events").delete().eq("institution_id", institutionA),
    );
  },
);
await verify("mutațiile nu trec între instituții, nici cu identificatori cunoscuți", async () => {
  await denied(
    await sessions.adminA.rpc("save_substation", {
      p_id: foreignStation,
      p_name: "Atac",
      p_active: false,
      p_reason: "Test interinstituții",
    }),
  );
  await denied(
    await sessions.adminA.rpc("set_account_access", {
      p_user: foreign.id,
      p_active: false,
      p_roles: [],
      p_reason: "Test interinstituții",
    }),
  );
});
await verify("un rol invalid anulează tranzacția completă și auditul parțial", async () => {
  const before = await ids(sessions.adminA, "audit_events");
  await denied(
    await sessions.adminA.rpc("set_account_access", {
      p_user: fixture.accounts.warehouseA.id,
      p_active: false,
      p_roles: [local("warehouse", stationA), local("warehouse", foreignStation)],
      p_reason: "Test rollback integral",
    }),
  );
  assert.deepEqual(await ids(sessions.warehouseA, "substations"), [stationA]);
  assert.deepEqual(await ids(sessions.adminA, "audit_events"), before);
  await denied(
    await sessions.adminA.rpc("set_account_access", {
      p_user: fixture.accounts.warehouseA.id,
      p_active: true,
      p_roles: [local("administrator", stationA)],
      p_reason: "Test rol global local",
    }),
  );
});
await verify(
  "dezactivarea contului și a substației revocă imediat accesul cu JWT existent",
  async () => {
    await grant("adminA", "warehouseA", [local("warehouse", stationA)], false);
    assert.deepEqual(await ids(sessions.warehouseA, "substations"), []);
    assert.equal(
      await rpc(sessions.warehouseA, "can_access_owned_record", {
        p_substation: stationA,
        p_owner: fixture.accounts.warehouseA.id,
      }),
      false,
    );
    await grant("adminA", "warehouseA", [local("warehouse", stationA)]);
    await rpc(sessions.adminA, "save_substation", {
      p_id: stationA,
      p_name: "Verificare A",
      p_active: false,
      p_reason: "Test substație inactivă",
    });
    assert.deepEqual(await ids(sessions.leaderA, "substations"), []);
    await rpc(sessions.adminA, "save_substation", {
      p_id: stationA,
      p_name: "Verificare A",
      p_active: true,
      p_reason: "Restaurare fixture M02",
    });
  },
);
await verify("auditul reține autorul, motivul și versiunile; este izolat", async () => {
  const events = checked(
    await sessions.adminA
      .from("audit_events")
      .select("actor_id,reason,before_data,after_data")
      .eq("entity_table", "substations")
      .eq("action", "UPDATE"),
    "Audit",
  );
  assert.ok(events.length >= 2);
  assert.ok(
    events.every(
      (event) =>
        event.actor_id === a.id &&
        event.reason.length >= 5 &&
        event.before_data &&
        event.after_data,
    ),
  );
  assert.deepEqual(await ids(sessions.warehouseA, "audit_events"), []);
  assert.deepEqual(
    checked(
      await sessions.foreignAdmin
        .from("audit_events")
        .select("id")
        .eq("institution_id", institutionA),
      "Audit izolat",
    ),
    [],
  );
});
await verify("concurența nu permite eliminarea reciprocă a ultimilor administratori", async () => {
  await denied(
    await sessions.adminA.rpc("set_account_access", {
      p_user: a.id,
      p_active: false,
      p_roles: [],
      p_reason: "Test modificare proprie",
    }),
  );
  for (let iteration = 0; iteration < 3; iteration++) {
    const attempts = await Promise.all([
      sessions.adminA.rpc("set_account_access", {
        p_user: fixture.accounts.adminB.id,
        p_active: false,
        p_roles: [],
        p_reason: "Test concurență A",
      }),
      sessions.adminB.rpc("set_account_access", {
        p_user: a.id,
        p_active: false,
        p_roles: [],
        p_reason: "Test concurență B",
      }),
    ]);
    assert.equal(
      attempts.filter((result) => !result.error).length,
      1,
      "Exact un administrator poate revoca pe celălalt",
    );
    const survivor = attempts[0].error ? "adminB" : "adminA";
    await grant(survivor, survivor === "adminA" ? "adminB" : "adminA", globalAdmin);
  }
});
await verify("aceeași denumire creată concurent produce o singură substație", async () => {
  const attempts = await Promise.all(
    [0, 1].map(() =>
      sessions.adminA.rpc("save_substation", {
        p_id: null,
        p_name: "Concurență denumire",
        p_active: true,
        p_reason: "Test concurență substație",
      }),
    ),
  );
  assert.equal(attempts.filter((result) => !result.error).length, 1);
});
console.log(
  `${passed} grupuri de teste PostgreSQL/Supabase trecute. Fixture privată pregătită pentru E2E.`,
);

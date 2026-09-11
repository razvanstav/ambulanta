import assert from "node:assert/strict";

import { readFile, writeFile } from "node:fs/promises";
import {
  checked,
  configuration,
  login,
  privilegedClient,
  createAuthAccount,
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

for (const name of ["m06uiDesktop", "m06uiMobile"]) {
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
console.log("Fixture UI cantitativă: doi titulari și două mașini, în instituția temporară.");

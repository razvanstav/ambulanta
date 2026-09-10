import { readFile, writeFile } from "node:fs/promises";
import {
  checked,
  configuration,
  createAuthAccount,
  login,
  privilegedClient,
} from "./supabase-tools.mjs";

const { url } = configuration();
const initial = JSON.parse(
  await readFile(new URL("../private/initial-admin.json", import.meta.url), "utf8"),
);
if (initial.url !== url) throw new Error("Administratorul local aparține altui proiect.");
const client = await login(initial);
const admin = privilegedClient();
const institutions = checked(
  await client.from("institutions").select("id,name"),
  "Instituție demo",
);
const institution = institutions.find((item) => item.name === "SAJ — Demonstrație");
if (!institution)
  throw new Error("Popularea este permisă numai în instituția fictivă inițializată.");
const station = checked(
  await client
    .from("substations")
    .select("id,name,active")
    .eq("institution_id", institution.id)
    .eq("name", "Roșiori")
    .single(),
  "Substație demo",
);
if (!station.active) throw new Error("Substația demo este inactivă; nu îi schimb automat starea.");
const file = new URL("../private/m03-demo-accounts.json", import.meta.url);
let saved = { url, institutionId: institution.id, stationId: station.id, accounts: {} };
try {
  saved = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (saved.url !== url || saved.stationId !== station.id)
  throw new Error("Manifestul privat nu corespunde substației demo.");
async function persist() {
  await writeFile(file, JSON.stringify(saved, null, 2), { mode: 0o600 });
}
const people = [
  ["Mihai Dobre", "Asistent medical", true],
  ["Elena Marin", "Asistent medical", true],
  ["Andrei Stoica", "Medic", true],
  ["Ioana Radu", "Asistent medical", false],
  ["Vlad Neagu", "Ambulanțier", false],
  ["Cristina Pavel", "Asistent medical", false],
  ["Sorin Ilie", "Ambulanțier", false],
  ["Diana Matei", "Medic", false],
  ["Radu Enache", "Ambulanțier", false],
  ["Alina Dinu", "Asistent medical", false],
];
let addedEmployees = 0;
let addedVehicles = 0;
for (const [index, [name, job, titular]] of people.entries()) {
  const suffix = String(index + 1).padStart(2, "0");
  const code = `DEMO-EMP-${suffix}`;
  const existing = checked(
    await client.from("employees").select("id").eq("code", code).maybeSingle(),
    "Verificare angajat demo",
  );
  if (existing) continue; // Re-running never overwrites edits made by the user.
  let accountId = null;
  if (titular) {
    if (!saved.accounts[code]) {
      saved.accounts[code] = {
        name,
        ...(await createAuthAccount(admin, `titular.rosiori.${suffix}@ambulanta.example.invalid`, {
          purpose: "m03-demo-holder",
        })),
      };
      await persist();
    }
    const account = saved.accounts[code];
    accountId = account.id;
    const profile = checked(
      await client.from("profiles").select("id").eq("id", account.id).maybeSingle(),
      "Profil titular",
    );
    if (!profile)
      checked(
        await client.rpc("register_account", {
          p_user: account.id,
          p_name: name,
          p_reason: "Cont individual fictiv pentru titularul demo",
        }),
        "Înregistrare titular",
      );
    const roles = checked(
      await client.from("role_assignments").select("role,substation_id").eq("user_id", account.id),
      "Roluri titular",
    );
    if (!roles.some((role) => role.role === "shift_leader" && role.substation_id === station.id))
      checked(
        await client.rpc("set_account_access", {
          p_user: account.id,
          p_active: true,
          p_roles: [...roles, { role: "shift_leader", substation_id: station.id }],
          p_reason: "Acces propriu pentru titularul fictiv al substației",
        }),
        "Atribuire rol titular",
      );
  }
  checked(
    await client.rpc("save_employee", {
      p_substation: station.id,
      p_employee: null,
      p_code: code,
      p_name: name,
      p_job_title: job,
      p_active: true,
      p_is_titular: titular,
      p_account: accountId,
      p_reason: "Populare fictivă cerută: 10 angajați, 3 titulari",
    }),
    "Creare angajat",
  );
  addedEmployees++;
}
for (let index = 1; index <= 5; index++) {
  const identifier = `DEMO-AMB-${String(index).padStart(2, "0")}`;
  const existing = checked(
    await client.from("vehicles").select("id").eq("identifier", identifier).maybeSingle(),
    "Verificare mașină demo",
  );
  if (existing) continue;
  checked(
    await client.rpc("save_vehicle", {
      p_substation: station.id,
      p_vehicle: null,
      p_identifier: identifier,
      p_description:
        index === 5 ? "Ambulanță tip C — exemplu fictiv" : "Ambulanță tip B — exemplu fictiv",
      p_active: true,
      p_operational: true,
      p_reason: "Populare fictivă cerută: 5 mașini în Roșiori",
    }),
    "Creare mașină",
  );
  addedVehicles++;
}
await persist();
const members = checked(
  await client
    .from("employee_assignments")
    .select("id,is_titular,active")
    .eq("substation_id", station.id),
  "Total personal",
);
const vehicles = checked(
  await client.from("vehicles").select("id").eq("substation_id", station.id),
  "Total flotă",
);
const holders = checked(
  await client.rpc("list_eligible_holders", { p_substation: station.id }),
  "Titulari eligibili",
);
console.log(
  JSON.stringify({
    substation: station.name,
    employees: members.length,
    titulari: members.filter((member) => member.is_titular).length,
    eligible: holders.length,
    vehicles: vehicles.length,
    addedEmployees,
    addedVehicles,
    credentialsFile: "private/m03-demo-accounts.json",
  }),
);

import { readFile, unlink } from "node:fs/promises";
import { checked, configuration, privilegedClient } from "./supabase-tools.mjs";

const file = new URL("../.verification/m02-fixtures.json", import.meta.url);
const fixture = JSON.parse(await readFile(file, "utf8"));
const { url } = configuration();
if (fixture.url !== url || process.env.M02_TEST_PROJECT_REF !== new URL(url).hostname.split(".")[0])
  throw new Error("Proiectul de test nu corespunde fixturei.");
const admin = privilegedClient();
const accountIds = new Set(Object.values(fixture.accounts).map((account) => account.id));
// Check ownership of every target BEFORE any deletion. IDs originate in this run's private manifest.
for (const id of fixture.institutions) {
  const institution = checked(
    await admin.from("institutions").select("name").eq("id", id).maybeSingle(),
    "Verificare instituție test",
  );
  if (institution && !institution.name.startsWith(`M02 test ${fixture.run} `))
    throw new Error("Ținta nu aparține acestui test.");
  const profiles = checked(
    await admin.from("profiles").select("id").eq("institution_id", id),
    "Inventar conturi de test",
  );
  for (const profile of profiles) accountIds.add(profile.id);
}
for (const id of accountIds) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error && error.status !== 404)
    throw new Error("Identitatea fixturei nu poate fi verificată.");
  const isUiFixture =
    data.user?.email?.startsWith("ui-") &&
    data.user.email.endsWith(`.${fixture.run}@example.invalid`);
  if (data.user && data.user.app_metadata.m02_fixture !== fixture.run && !isUiFixture)
    throw new Error("Contul nu aparține acestui test.");
}
for (const id of fixture.institutions) {
  // Privileged cleanup is limited to generated test institutions; application users cannot delete audit.
  checked(
    await admin.from("role_assignments").delete().eq("institution_id", id),
    "Curățare roluri test",
  );
  checked(
    await admin.from("profiles").delete().eq("institution_id", id),
    "Curățare profiluri test",
  );
  checked(
    await admin.from("substations").delete().eq("institution_id", id),
    "Curățare substații test",
  );
  checked(
    await admin.from("audit_events").delete().eq("institution_id", id),
    "Curățare audit test",
  );
  checked(await admin.from("institutions").delete().eq("id", id), "Curățare instituție test");
}
for (const id of accountIds) checked(await admin.auth.admin.deleteUser(id), "Curățare Auth test");
await unlink(file);
console.log("Au fost eliminate numai instituțiile și conturile generate de fixturea M02.");

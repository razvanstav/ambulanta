import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  checked,
  configuration,
  createAuthAccount,
  login,
  privilegedClient,
} from "./supabase-tools.mjs";

const file = new URL("../private/initial-admin.json", import.meta.url);
const admin = privilegedClient();
const { url } = configuration();
let saved;
try {
  saved = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (saved) {
  if (saved.url !== url)
    throw new Error("Fișierul local aparține altui proiect. Nu este reutilizat automat.");
  const profile = checked(
    await admin.from("profiles").select("id").eq("id", saved.id).maybeSingle(),
    "Verificare administrator",
  );
  if (!profile)
    throw new Error(
      "Configurare anterioară incompletă. Verifică profilul Auth local înainte de reluare.",
    );
  console.log("Administratorul există deja; datele de acces rămân în private/initial-admin.json.");
} else {
  // Intended only for a fresh fictitious demonstration, never for operational data.
  const existing = checked(
    await admin.from("institutions").select("id").eq("name", "SAJ — Demonstrație").limit(1),
    "Verificare inițializare",
  );
  if (existing.length)
    throw new Error("Instituția demo există deja. Nu creez un administrator suplimentar automat.");
  const account = await createAuthAccount(admin, "administrator@ambulanta.example.invalid", {
    purpose: "demo-bootstrap",
  });
  await mkdir(new URL("../private/", import.meta.url), { recursive: true });
  // Store the randomly generated password before DB setup, so interruptions are recoverable.
  await writeFile(file, JSON.stringify({ url, ...account }, null, 2), { flag: "wx", mode: 0o600 });
  const institutionId = checked(
    await admin.rpc("bootstrap_institution", {
      p_admin: account.id,
      p_name: "SAJ — Demonstrație",
      p_admin_name: "Administrator Demo",
    }),
    "Inițializare instituție",
  );
  const session = await login(account);
  for (const name of ["Roșiori", "Alexandria"])
    checked(
      await session.rpc("save_substation", {
        p_id: null,
        p_name: name,
        p_active: true,
        p_reason: "Configurare inițială pentru demonstrație",
      }),
      "Inițializare substație",
    );
  await writeFile(file, JSON.stringify({ url, institutionId, ...account }, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Administratorul demo și cele două substații sunt create. Acces: private/initial-admin.json (ignorat de Git).",
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/ui/action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { requireAdministrator } from "./server";
import { isUuid, safeNextPath, roleLabels, type RoleAssignment, type AppRole } from "./policy";

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
function validReason(reason: string) {
  return reason.length >= 5 && reason.length <= 500;
}
function validName(name: string) {
  return name.length >= 2 && name.length <= 120;
}
function failure(code?: string): ActionResult {
  return {
    message:
      code === "23505"
        ? "Există deja o înregistrare cu aceste date."
        : "Operația nu a fost salvată. Verifică datele și drepturile contului.",
  };
}

export async function signIn(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  if (!supabaseConfig())
    return { message: "Conexiunea nu este configurată. Contactează administratorul." };
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 128)
    return { message: "Completează adresa de e-mail și parola." };
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { message: "Autentificarea nu a reușit. Verifică datele și încearcă din nou." };
  const {
    data: { user },
  } = await client.auth.getUser();
  const own = user
    ? await client.from("profiles").select("active").eq("id", user.id).maybeSingle()
    : null;
  if (!user || own?.error || !own?.data?.active) {
    await client.auth.signOut({ scope: "local" });
    return { message: "Contul nu are acces activ în aplicație. Contactează administratorul." };
  }
  redirect(safeNextPath(form.get("next")));
}

export async function signOut() {
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Sesiunea nu a putut fi închisă. Încearcă din nou.");
  redirect("/autentificare");
}

export async function saveSubstation(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireAdministrator();
  const id = text(form, "id");
  const name = text(form, "name");
  const reason = text(form, "reason");
  if ((id && !isUuid(id)) || !validName(name) || !validReason(reason)) return failure();
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("save_substation", {
    p_id: id || null,
    p_name: name,
    p_active: form.get("active") === "on",
    p_reason: reason,
  });
  if (error) return failure(error.code);
  revalidatePath("/", "layout");
  return { success: true, message: "Substația a fost salvată." };
}

export async function createAccount(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireAdministrator();
  const name = text(form, "name");
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");
  const reason = text(form, "reason");
  if (
    !validName(name) ||
    !validReason(reason) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 12 ||
    password.length > 128
  )
    return { message: "Verifică datele. Parola trebuie să aibă între 12 și 128 de caractere." };
  const admin = createAuthAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    return {
      message: "Contul nu a fost creat. Verifică adresa de e-mail (poate exista deja) și parola.",
    };
  const client = await createSupabaseServerClient();
  const registered = await client.rpc("register_account", {
    p_user: data.user.id,
    p_name: name,
    p_reason: reason,
  });
  if (registered.error) {
    // Compensate only the brand-new Auth account; never touch an existing account.
    const cleanup = await admin.auth.admin.deleteUser(data.user.id);
    return cleanup.error
      ? {
          message:
            "Profilul nu a fost salvat. Administratorul infrastructurii trebuie să verifice contul Auth nou creat.",
        }
      : failure(registered.error.code);
  }
  revalidatePath("/administrare");
  return {
    success: true,
    message:
      "Contul a fost creat. Atribuie-i roluri din lista de conturi pentru acces la substații.",
  };
}

export async function setAccountAccess(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireAdministrator();
  const user = text(form, "user");
  const reason = text(form, "reason");
  if (!isUuid(user) || !validReason(reason)) return failure();
  const values = form.getAll("roles");
  if (values.length > 100) return failure();
  const roles: RoleAssignment[] = [];
  for (const value of values) {
    if (typeof value !== "string") return failure();
    const [role, station, extra] = value.split(":");
    if (
      !Object.hasOwn(roleLabels, role) ||
      extra !== undefined ||
      (station !== "global" && !isUuid(station))
    )
      return failure();
    roles.push({ role: role as AppRole, substation_id: station === "global" ? null : station });
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("set_account_access", {
    p_user: user,
    p_active: form.get("active") === "on",
    p_roles: roles,
    p_reason: reason,
  });
  if (error) return failure(error.code);
  revalidatePath("/", "layout");
  return { success: true, message: "Drepturile au fost salvate și înregistrate în audit." };
}

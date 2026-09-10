import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { isAdmin, isUuid, type Identity, type RoleAssignment, type Substation } from "./policy";

export const getIdentity = cache(async (): Promise<Identity | null> => {
  if (!supabaseConfig()) return null;
  const client = await createSupabaseServerClient();
  // Verify against Auth, not against cookie-provided user data.
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const [profile, roles, stations] = await Promise.all([
    client
      .from("profiles")
      .select("id,institution_id,display_name,active")
      .eq("id", user.id)
      .maybeSingle(),
    client.from("role_assignments").select("role,substation_id").eq("user_id", user.id),
    client.from("substations").select("id,institution_id,name,active").order("name"),
  ]);
  if (profile.error || roles.error || stations.error)
    throw new Error(
      "Datele de acces nu pot fi încărcate. Verifică serviciul Supabase și migrarea M02.",
    );
  if (!profile.data?.active) return null;
  return {
    id: user.id,
    institutionId: profile.data.institution_id,
    displayName: profile.data.display_name,
    email: user.email ?? "",
    roles: roles.data as RoleAssignment[],
    substations: stations.data as Substation[],
  };
});

export async function requireIdentity() {
  const identity = await getIdentity();
  if (!identity) redirect("/autentificare");
  return identity;
}
export async function requireAdministrator() {
  const identity = await requireIdentity();
  if (!isAdmin(identity)) notFound();
  return identity;
}
export async function requireSubstation(id: string) {
  const identity = await requireIdentity();
  const substation = identity.substations.find((item) => item.id === id && item.active);
  if (!isUuid(id) || !substation) notFound();
  return { identity, substation };
}

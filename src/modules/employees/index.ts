import "server-only";
import { notFound } from "next/navigation";
import { requireSubstation } from "@/modules/identity/server";
import { canViewLogistics } from "@/modules/identity/policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Employee = {
  id: string;
  code: string;
  display_name: string;
  user_id: string | null;
  job_title: string;
  active: boolean;
  is_titular: boolean;
};
export type EligibleHolder = { employee_id: string; display_name: string; user_id: string };
export async function getEmployees(stationId: string): Promise<Employee[]> {
  const { identity } = await requireSubstation(stationId);
  if (!canViewLogistics(identity, stationId)) notFound();
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("employee_assignments")
    .select("job_title,active,is_titular,employees!inner(id,code,display_name,user_id)")
    .eq("substation_id", stationId);
  if (error) throw new Error("Personalul nu a putut fi încărcat.");
  const rows = data as unknown as {
    job_title: string;
    active: boolean;
    is_titular: boolean;
    employees: Pick<Employee, "id" | "code" | "display_name" | "user_id">;
  }[];
  return rows
    .map(({ employees, ...membership }) => ({ ...employees, ...membership }))
    .sort((a, b) => a.code.localeCompare(b.code, "ro"));
}
export async function getEligibleHolders(stationId: string): Promise<EligibleHolder[]> {
  await requireSubstation(stationId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("list_eligible_holders", { p_substation: stationId });
  if (error) throw new Error("Titularii eligibili nu au putut fi verificați.");
  return data as EligibleHolder[];
}
export async function resolveMyHolder(stationId: string): Promise<EligibleHolder | null> {
  await requireSubstation(stationId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("resolve_my_holder", { p_substation: stationId });
  if (error) throw new Error("Identitatea titularului nu a putut fi verificată.");
  return (data as EligibleHolder[])[0] ?? null;
}

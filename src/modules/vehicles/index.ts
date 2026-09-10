import "server-only";
import { requireSubstation } from "@/modules/identity/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Vehicle = {
  id: string;
  identifier: string;
  description: string;
  active: boolean;
  operational: boolean;
};
export async function getVehicles(stationId: string): Promise<Vehicle[]> {
  await requireSubstation(stationId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("vehicles")
    .select("id,identifier,description,active,operational")
    .eq("substation_id", stationId)
    .order("identifier");
  if (error) throw new Error("Mașinile nu au putut fi încărcate.");
  return data as Vehicle[];
}
// M06 will add occupied/reserved state and an atomic check when starting a request.
export async function getAvailableVehicles(stationId: string) {
  return (await getVehicles(stationId)).filter((vehicle) => vehicle.active && vehicle.operational);
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/modules/inventory/rules";
import { units, type Unit } from "@/modules/catalog/rules";

export type VehicleStock = {
  vehicle_id: string;
  vehicle_identifier: string;
  product_id: string;
  product_name: string;
  base_unit: Unit;
  lot_code: string;
  expires_on: string | null;
  blocked: boolean;
  quantity: number;
};
export async function getVehicleStock(stationId: string, vehicleId?: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("list_vehicle_product_stock", {
    p_substation: stationId,
    p_vehicle: vehicleId ?? null,
  });
  if (error)
    throw new Error(
      "Stocul mașinilor nu poate fi încărcat. Verifică migrarea pentru stocul permanent.",
    );
  return data as VehicleStock[];
}
export function VehicleStockTable({ rows }: { rows: VehicleStock[] }) {
  return rows.length ? (
    <div className="table-scroll">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Produs</th>
            <th>În mașină</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.vehicle_id}-${row.product_id}`}>
              <td>{row.product_name}</td>
              <td>
                {formatQuantity(row.quantity)} {units[row.base_unit]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="identity-note">Mașina nu are materiale în stoc.</p>
  );
}

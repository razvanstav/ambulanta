import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/modules/inventory/rules";
import { units, lotStatus, type Unit } from "@/modules/catalog/rules";

export type VehicleStock = {
  vehicle_id: string;
  vehicle_identifier: string;
  lot_id: string;
  product_name: string;
  base_unit: Unit;
  lot_code: string;
  expires_on: string | null;
  blocked: boolean;
  quantity: number;
};
export async function getVehicleStock(stationId: string, vehicleId?: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("list_vehicle_stock", {
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
            <th>Produs / lot</th>
            <th>În mașină</th>
            <th>Stare lot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.vehicle_id}-${row.lot_id}`}>
              <td>
                {row.product_name}
                <small className="cell-secondary">
                  {row.lot_code} · {row.expires_on ?? "fără expirare"}
                </small>
              </td>
              <td>
                {formatQuantity(row.quantity)} {units[row.base_unit]}
              </td>
              <td>{lotStatus(row.blocked, row.expires_on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="identity-note">Mașina nu are materiale în stoc.</p>
  );
}

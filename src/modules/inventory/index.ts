import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalog } from "@/modules/catalog";

export type Balance = { lot_id: string; product_id: string; location_id: string; quantity: number };
export type Location = {
  id: string;
  kind: "warehouse" | "shift" | "vehicle";
  shift_id: string | null;
};
export type Receipt = {
  id: string;
  document_number: string;
  document_date: string;
  supplier: string;
  operation_id: string;
};
export async function getInventory(stationId: string) {
  const catalog = await getCatalog(stationId);
  const client = await createSupabaseServerClient();
  const [balances, locations, receipts] = await Promise.all([
    client
      .from("stock_balances")
      .select("lot_id,product_id,location_id,quantity")
      .eq("substation_id", stationId),
    client.from("inventory_locations").select("id,kind,shift_id").eq("substation_id", stationId),
    client
      .from("receipts")
      .select("id,document_number,document_date,supplier,operation_id")
      .eq("substation_id", stationId)
      .order("document_date", { ascending: false }),
  ]);
  if (balances.error || locations.error || receipts.error)
    throw new Error("Stocul nu a putut fi încărcat.");
  const warehouse = (locations.data as Location[]).find((l) => l.kind === "warehouse");
  const options = catalog.products.map((product) => {
    const active =
      product.active && catalog.settings.some((s) => s.product_id === product.id && s.active);
    const balance =
      (balances.data as Balance[])
        .filter((b) => b.location_id === warehouse?.id && b.product_id === product.id)
        .reduce((sum, b) => sum + Math.round(Number(b.quantity) * 1000), 0) / 1000;
    return {
      id: product.id,
      product_id: product.id,
      product,
      active,
      balance,
      available: active ? balance : 0,
    };
  });
  return {
    ...catalog,
    balances: balances.data as Balance[],
    locations: locations.data as Location[],
    receipts: receipts.data as Receipt[],
    options,
  };
}

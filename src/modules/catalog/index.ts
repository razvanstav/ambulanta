import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { canViewLogistics } from "@/modules/identity/policy";
import type { Category, Unit } from "./rules";

export type Product = {
  id: string;
  code: string;
  name: string;
  category: Category;
  base_unit: Unit;
  quantity_precision: number;
  track_lots: boolean;
  track_expiry: boolean;
  active: boolean;
};
export type StationProduct = { product_id: string; minimum_quantity: number; active: boolean };
export type StockLot = {
  id: string;
  product_id: string;
  lot_code: string;
  expires_on: string | null;
  is_internal: boolean;
  blocked: boolean;
};

export async function getCatalog(stationId: string) {
  const { identity } = await requireSubstation(stationId);
  if (!canViewLogistics(identity, stationId)) notFound();
  const client = await createSupabaseServerClient();
  const [products, settings, lots] = await Promise.all([
    client
      .from("products")
      .select("id,code,name,category,base_unit,quantity_precision,track_lots,track_expiry,active")
      .order("name"),
    client
      .from("station_product_settings")
      .select("product_id,minimum_quantity,active")
      .eq("substation_id", stationId),
    client
      .from("stock_lots")
      .select("id,product_id,lot_code,expires_on,is_internal,blocked")
      .eq("substation_id", stationId)
      .order("expires_on", { nullsFirst: false })
      .order("lot_code"),
  ]);
  if (products.error || settings.error || lots.error)
    throw new Error("Catalogul și loturile nu au putut fi încărcate.");
  return {
    products: products.data as Product[],
    settings: settings.data as StationProduct[],
    lots: lots.data as StockLot[],
  };
}

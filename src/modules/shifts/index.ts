import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSubstation } from "@/modules/identity/server";
import { notFound } from "next/navigation";
import { canUseMyShift, canViewLogistics } from "@/modules/identity/policy";
import type { Unit } from "@/modules/catalog/rules";

export type Shift = {
  id: string;
  owner_id: string;
  employee_id: string;
  vehicle_id: string;
  holder_name: string;
  vehicle_identifier: string;
  state:
    "awaiting_issue" | "awaiting_acceptance" | "open" | "pending_close" | "closed" | "cancelled";
  requested_at: string;
  started_at: string | null;
  operational_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
};
export type Sheet = {
  id: string;
  shift_id: string;
  version: number;
  kind: "initial" | "supplement";
  state: "draft" | "sent" | "disputed" | "superseded" | "withdrawn" | "accepted";
  author_id: string;
  created_at: string;
  sent_at: string | null;
  note: string;
};
export type SheetLine = {
  id: string;
  sheet_id: string;
  lot_id: string;
  product_name: string;
  base_unit: Unit;
  lot_code: string;
  expires_on: string | null;
  quantity: number;
};
export async function getShifts(stationId: string, own: boolean) {
  const { identity } = await requireSubstation(stationId);
  if (own ? !canUseMyShift(identity, stationId) : !canViewLogistics(identity, stationId))
    notFound();
  const client = await createSupabaseServerClient();
  let query = client
    .from("shifts")
    .select(
      "id,owner_id,employee_id,vehicle_id,holder_name,vehicle_identifier,state,requested_at,started_at,operational_date,planned_start,planned_end",
    )
    .eq("substation_id", stationId)
    .order("requested_at", { ascending: false });
  if (own) query = query.eq("owner_id", identity.id);
  const shifts = await query;
  if (shifts.error) throw new Error("Turele nu au putut fi încărcate.");
  if (!shifts.data.length)
    return { shifts: [] as Shift[], sheets: [] as Sheet[], lines: [] as SheetLine[] };
  const sheets = await client
    .from("issue_sheet_versions")
    .select("id,shift_id,version,kind,state,author_id,created_at,sent_at,note")
    .in(
      "shift_id",
      shifts.data.map((s) => s.id),
    )
    .order("version", { ascending: false });
  if (sheets.error) throw new Error("Fișele nu au putut fi încărcate.");
  const lines = sheets.data.length
    ? await client
        .from("issue_sheet_lines")
        .select("id,sheet_id,lot_id,product_name,base_unit,lot_code,expires_on,quantity")
        .in(
          "sheet_id",
          sheets.data.map((s) => s.id),
        )
    : { data: [], error: null };
  if (lines.error) throw new Error("Liniile fișelor nu au putut fi încărcate.");
  return {
    shifts: shifts.data as Shift[],
    sheets: sheets.data as Sheet[],
    lines: lines.data as SheetLine[],
  };
}

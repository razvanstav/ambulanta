import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/identity/policy";
import { generateShiftPdf } from "@/modules/reports/pdf";
import type { ShiftReport } from "@/modules/reports/shift-report";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const denied = () => new Response("Raport inaccesibil.", { status: 404, headers });
  if (!isUuid(id)) return denied();
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return denied();
  // User-scoped reads enforce the same RLS as the shift history. No service key.
  const { data: shift, error } = await client
    .from("shifts")
    .select("id,closed_at,final_closeout_id")
    .eq("id", id)
    .eq("state", "closed")
    .maybeSingle();
  if (error || !shift?.final_closeout_id || !shift.closed_at) return denied();
  const { data: version, error: versionError } = await client
    .from("closeout_versions")
    .select("version,content_hash,content")
    .eq("id", shift.final_closeout_id)
    .eq("shift_id", id)
    .maybeSingle();
  if (versionError || !version) return denied();
  try {
    const bytes = await generateShiftPdf({
      id,
      closed_at: shift.closed_at,
      ...version,
    } as ShiftReport);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="raport-tura-${id}.pdf"`,
      },
    });
  } catch {
    return new Response("PDF-ul nu a putut fi generat. Tura rămâne închisă; încearcă din nou.", {
      status: 503,
      headers,
    });
  }
}

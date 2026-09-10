import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/identity/policy";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = () =>
    new Response("Dovadă inaccesibilă.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (!isUuid(id)) return denied();
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return denied();
  const { data: file } = await client
    .from("evidence_files")
    .select("object_path,mime_type")
    .eq("id", id)
    .eq("state", "validated")
    .maybeSingle();
  if (!file) return denied();
  // Both the metadata query and the Storage download enforce current RLS.
  const { data, error } = await client.storage.from("shift-evidence").download(file.object_path);
  if (error || !data) return denied();
  return new Response(data, {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
    },
  });
}

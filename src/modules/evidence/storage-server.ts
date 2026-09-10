import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";

// Trusted validation boundary. Never expose this client or key to the browser.
// Call only after Auth + RLS checks; the RPC rechecks the actor under the shift lock.
export function createEvidenceStorageClient() {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key)
    throw new Error("Serviciul de validare a dovezilor nu este configurat pe server.");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

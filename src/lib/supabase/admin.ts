import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// Only Auth account provisioning uses this client. Application data uses the
// authenticated user's client and RLS, including administrative mutations.
export function createAuthAdminClient() {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) throw new Error("Administrarea conturilor nu este configurată.");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";

// A Supabase gateway can briefly lag the Auth issuer clock. Retry only the
// explicit pre-execution JWT rejection, never an uncertain mutation response.
async function testFetch(...args) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(...args);
    if (response.status !== 401 || attempt === 3) return response;
    const error = await response
      .clone()
      .json()
      .catch(() => null);
    if (error?.code !== "PGRST303" || error?.message !== "JWT issued at future") return response;
    await setTimeout(500);
  }
}

export function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secret)
    throw new Error("Configurează Supabase în .env.local înainte de rulare.");
  return { url, key, secret };
}
export function publicClient() {
  const { url, key } = configuration();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: testFetch },
  });
}
export function privilegedClient() {
  const { url, secret } = configuration();
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function checked(result, context) {
  if (result.error)
    throw new Error(`${context}: ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
}
export async function login(account) {
  const client = publicClient();
  checked(
    await client.auth.signInWithPassword({ email: account.email, password: account.password }),
    "Autentificare test",
  );
  return client;
}
export async function createAuthAccount(admin, email, metadata = {}) {
  const password = randomBytes(24).toString("base64url") + "aA1!";
  const { user } = checked(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: metadata,
    }),
    "Creare Auth",
  );
  return { id: user.id, email, password };
}

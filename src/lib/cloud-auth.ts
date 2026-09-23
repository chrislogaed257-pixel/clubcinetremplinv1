import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function cloudFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/** Authentifie une opération même si l'hébergeur n'a transmis que les variables publiques VITE. */
export const requireCloudAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("La connexion à Lovable Cloud est indisponible. Réessayez.");

  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const token = authHeader.slice(7);
  const supabase = createClient<any>(url, key, {
    global: { fetch: cloudFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) throw new Error("Votre session a expiré. Reconnectez-vous.");
  return next({ context: { supabase, userId, claims: data.claims } });
});
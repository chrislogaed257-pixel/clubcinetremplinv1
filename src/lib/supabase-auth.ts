import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

function isOpaqueKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function cloudFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }
    if (isOpaqueKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Authentification des fonctions du club.
 * Les variables VITE, déjà intégrées au site publié, servent de repli aux
 * hébergeurs qui ne recopient pas automatiquement les noms réservés côté serveur.
 */
export const requireCloudAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
    const key =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

    if (!url || !key) {
      throw new Error("La connexion à Lovable Cloud est momentanément indisponible. Réessayez.");
    }

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Votre session a expiré. Reconnectez-vous.");
    const token = authHeader.slice(7);
    if (token.split(".").length !== 3) throw new Error("Votre session a expiré. Reconnectez-vous.");

    const supabase = createClient<Database>(url, key, {
      global: {
        fetch: cloudFetch(key),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || !userId) throw new Error("Votre session a expiré. Reconnectez-vous.");

    return next({ context: { supabase, userId, claims: data.claims } });
  },
);
import { getRequest } from "@tanstack/react-start/server";

const RELAY_URL = "https://clubcinetremplinv1.lovable.app/api/public/fn-relay";

/** Vrai quand l'hébergement (ex. Vercel) n'a pas la clé serveur privée. */
export function needsRelay() {
  return !process.env["SUPABASE_SERVICE_ROLE_KEY"] || !process.env["SUPABASE_URL"];
}

/** Exécute l'opération sur l'instance Lovable, avec la même session et les mêmes contrôles d'accès. */
export async function relayFn<T = any>(name: string, data?: unknown): Promise<T> {
  const auth = getRequest()?.headers.get("authorization");
  const response = await fetch(RELAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ name, data: data ?? null }),
  });
  const result = (await response.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!response.ok) throw new Error(result.error ?? "Opération impossible");
  return result.result as T;
}

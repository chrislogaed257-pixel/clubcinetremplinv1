import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireCloudAuth } from "./cloud-auth";

/**
 * Vote anonyme. Tout passe par des fonctions protégées de la base : aucune clé
 * serveur privée n'est nécessaire, ce qui permet au vote de fonctionner sur
 * n'importe quel hébergement (Lovable, Vercel…).
 */

export type VoteProject = { code: string; title: string; description: string };

function publicClient(bearer?: string) {
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("La connexion à la base est indisponible. Réessayez.");
  return createClient<any>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.delete("Authorization");
        if (bearer) h.set("Authorization", `Bearer ${bearer}`);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function rpc<T>(fn: string, args: Record<string, unknown>, bearer?: string): Promise<T> {
  const { data, error } = await publicClient(bearer).rpc(fn, args);
  if (error) {
    console.error(`[vote] ${fn}`, error.message);
    throw new Error("Vote indisponible pour le moment. Réessayez.");
  }
  return data as T;
}

type OpenResult =
  | { ok: false; error: string }
  | { ok: true; session: any; projects: VoteProject[] };

const loginInput = z.object({ login: z.string().min(1), code: z.string().min(1) });
export const voteLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginInput.parse(d))
  .handler(async ({ data }) =>
    rpc<OpenResult>("vote_public_open", { _token: null, _login: data.login, _code: data.code }),
  );

const openInput = z.object({ token: z.string().min(8) });
export const voteOpen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => openInput.parse(d))
  .handler(async ({ data }) => rpc<OpenResult>("vote_public_open", { _token: data.token.trim() }));

export const voteOpenCurrent = createServerFn({ method: "POST" }).handler(async () =>
  rpc<OpenResult>("vote_public_open", { _token: null }),
);

const stateInput = z.object({ sessionId: z.string().uuid(), token: z.string().min(8) });
type State = { used: number; votedCodes: string[] };

export const voteState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => stateInput.parse(d))
  .handler(async ({ data }) =>
    rpc<State>("vote_public_state", { _session: data.sessionId, _token: data.token }),
  );

const castInput = stateInput.extend({ code: z.string().min(1) });
export const castVote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => castInput.parse(d))
  .handler(async ({ data }) =>
    rpc<({ ok: true } & State) | { ok: false; error: string }>("vote_public_cast", {
      _session: data.sessionId,
      _token: data.token,
      _code: data.code,
    }),
  );

const resultsInput = z.object({ sessionId: z.string().uuid() });
type Results = { rows: { code: string; votes: number }[]; total: number; visible: boolean };

export const voteResults = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resultsInput.parse(d))
  .handler(async ({ data }) => {
    let bearer: string | undefined;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const auth = getRequest()?.headers.get("authorization");
      if (auth?.startsWith("Bearer ")) bearer = auth.slice(7);
    } catch {
      /* visiteur anonyme */
    }
    try {
      return await rpc<Results>("vote_public_results", { _session: data.sessionId }, bearer);
    } catch {
      return rpc<Results>("vote_public_results", { _session: data.sessionId });
    }
  });

/** Suivi privé en direct : réservé au Producteur général / administrateurs. */
export const producerLiveResults = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: unknown) => resultsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("vote_producer_results", {
      _session: data.sessionId,
    });
    if (error) throw new Error("Accès réservé au Producteur général.");
    return res as { rows: { projectId: string; votes: number }[]; total: number };
  });

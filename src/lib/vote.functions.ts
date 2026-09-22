import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Vote anonyme. Tout passe par le serveur : les tables de quota (A) et de voix (B)
 * ne sont accessibles à personne depuis l'application, et ne sont jamais jointes.
 */

const loginInput = z.object({ login: z.string().min(1), code: z.string().min(1) });

export type VoteProject = { code: string; title: string; description: string };

export const voteLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select(
        "id, title, description, status, max_votes, require_distinct, live_results, individual_codes, opened_at, closed_at, proclamation",
      )
      .eq("access_login", data.login.trim())
      .eq("access_code", data.code.trim())
      .maybeSingle();
    if (!session) return { ok: false as const, error: "Identifiant ou code incorrect." };
    if (!session.opened_at) return { ok: false as const, error: "Le vote n'est pas encore ouvert." };
    const { data: projects } = await supabaseAdmin
      .from("vote_projects")
      .select("code, title, description")
      .eq("session_id", session.id)
      .order("sort_order");
    return { ok: true as const, session, projects: (projects ?? []) as VoteProject[] };
  });

const openInput = z.object({ token: z.string().min(8) });

/**
 * Accès direct et immédiat : le lien partagé contient le jeton public de la session,
 * aucun identifiant ni validation d'accès n'est demandé.
 */
export const voteOpen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => openInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = data.token.trim();
    const cols =
      "id, title, description, status, max_votes, require_distinct, live_results, individual_codes, opened_at, closed_at, proclamation";
    let session = (
      await supabaseAdmin.from("vote_sessions").select(cols).eq("public_token", token).maybeSingle()
    ).data;
    if (!session)
      session = (
        await supabaseAdmin.from("vote_sessions").select(cols).eq("mentor_token", token).maybeSingle()
      ).data;
    if (!session) return { ok: false as const, error: "Ce lien de vote n'est pas valide." };
    if (!session.opened_at) return { ok: false as const, error: "Le vote n'est pas encore ouvert." };
    const { data: projects } = await supabaseAdmin
      .from("vote_projects")
      .select("code, title, description")
      .eq("session_id", session.id)
      .order("sort_order");
    return { ok: true as const, session, projects: (projects ?? []) as VoteProject[] };
  });

const stateInput = z.object({ sessionId: z.string().uuid(), token: z.string().min(8) });

async function readState(sessionId: string, token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: quota } = await supabaseAdmin
    .from("vote_quotas")
    .select("used, voted_codes")
    .eq("session_id", sessionId)
    .eq("voter_token", token)
    .maybeSingle();
  return { used: quota?.used ?? 0, votedCodes: (quota?.voted_codes ?? []) as string[] };
}

export const voteState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => stateInput.parse(d))
  .handler(async ({ data }) => readState(data.sessionId, data.token));

const castInput = stateInput.extend({ code: z.string().min(1) });

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => castInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select("id, status, max_votes, require_distinct, opened_at, closed_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || !session.opened_at || session.closed_at)
      return { ok: false as const, error: "Le vote est fermé." };

    const { data: project } = await supabaseAdmin
      .from("vote_projects")
      .select("code")
      .eq("session_id", session.id)
      .eq("code", data.code)
      .maybeSingle();
    if (!project) return { ok: false as const, error: "Projet inconnu." };

    const state = await readState(session.id, data.token);
    if (state.used >= (session.max_votes ?? 2))
      return {
        ok: false as const,
        error: `Vous avez déjà utilisé vos ${session.max_votes ?? 2} voix pour ce vote.`,
      };
    if (session.require_distinct && state.votedCodes.includes(data.code))
      return { ok: false as const, error: "Vos voix doivent aller à des projets différents." };

    // Table A : quota du jeton (aucune identité)
    const { error: quotaError } = await supabaseAdmin.from("vote_quotas").upsert(
      {
        session_id: session.id,
        voter_token: data.token,
        used: state.used + 1,
        voted_codes: [...state.votedCodes, data.code],
      },
      { onConflict: "session_id,voter_token" },
    );
    if (quotaError) return { ok: false as const, error: "Vote impossible pour le moment." };

    // Table B : voix anonyme (aucun jeton, aucun horodatage)
    await supabaseAdmin
      .from("vote_tallies")
      .insert({ session_id: session.id, project_code: data.code });

    return { ok: true as const, ...(await readState(session.id, data.token)) };
  });

const resultsInput = z.object({ sessionId: z.string().uuid() });

export const voteResults = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resultsInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select("id, status, live_results, opened_at, closed_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) return { rows: [], total: 0, visible: false };
    const closed = Boolean(session.closed_at);
    if (!closed && !session.live_results) return { rows: [], total: 0, visible: false };
    const { data: tallies } = await supabaseAdmin
      .from("vote_tallies")
      .select("project_code")
      .eq("session_id", session.id);
    const counts = new Map<string, number>();
    for (const t of tallies ?? [])
      counts.set(t.project_code, (counts.get(t.project_code) ?? 0) + 1);
    const rows = [...counts.entries()]
      .map(([code, votes]) => ({ code, votes }))
      .sort((a, b) => b.votes - a.votes);
    return { rows, total: tallies?.length ?? 0, visible: true };
  });

import { createServerFn } from "@tanstack/react-start";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const PRODUCER_POSITIONS = ["Producteur général", "Producteur délégué"];

async function producersOf(position: string) {
  const db = await admin();
  const { data: pos } = await db.from("positions").select("id").eq("name", position).maybeSingle();
  if (!pos) return [];
  const { data: pps } = await db
    .from("profile_positions")
    .select("profile_id")
    .eq("position_id", pos.id);
  const ids = (pps ?? []).map((p) => p.profile_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  return profiles ?? [];
}

/** Vérifie qu'un email correspond à un membre et renvoie les producteurs joignables. */
export const lookupMember = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const email = data.email.trim().toLowerCase();
    const { data: profile } = await db
      .from("profiles")
      .select("id, full_name")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) return { found: false as const };

    const producers: { position: string; name: string; email: string }[] = [];
    for (const position of PRODUCER_POSITIONS) {
      for (const p of await producersOf(position)) {
        producers.push({ position, name: p.full_name, email: p.email });
      }
    }

    const { data: requests } = await db
      .from("password_requests")
      .select("id, target_position, status, created_at")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false });

    const ids = (requests ?? []).map((r) => r.id);
    const { data: messages } = ids.length
      ? await db
          .from("password_messages")
          .select("id, request_id, from_member, content, created_at")
          .in("request_id", ids)
          .order("created_at")
      : { data: [] };

    return {
      found: true as const,
      name: profile.full_name,
      producers,
      requests: requests ?? [],
      messages: messages ?? [],
    };
  });

/** Envoi d'une demande d'aide depuis l'écran de connexion. */
export const sendPasswordRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; targetPosition: string; content: string }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const email = data.email.trim().toLowerCase();
    const { data: profile } = await db
      .from("profiles")
      .select("id, full_name")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) throw new Error("Adresse inconnue.");
    if (!PRODUCER_POSITIONS.includes(data.targetPosition)) throw new Error("Choix invalide.");
    if (!data.content.trim()) throw new Error("Message vide.");

    const { data: request, error } = await db
      .from("password_requests")
      .insert({
        requester_email: email,
        requester_id: profile.id,
        target_position: data.targetPosition,
      })
      .select("id")
      .single();
    if (error || !request) throw new Error(error?.message ?? "Envoi impossible");

    await db.from("password_messages").insert({
      request_id: request.id,
      from_member: true,
      author_id: profile.id,
      content: data.content.trim(),
    });

    const targets = await producersOf(data.targetPosition);
    if (targets.length > 0) {
      await db.from("notifications").insert(
        targets.map((t) => ({
          user_id: t.id,
          title: "Demande de mot de passe",
          body: `${profile.full_name} demande de l'aide pour se connecter.`,
          link: "/mot-de-passe",
        })),
      );
    }
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireCloudAuth } from "@/lib/cloud-auth";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Le producteur général, le délégué et les admins gèrent les demandes de mot de passe. */
async function assertHelper(context: { userId: string; supabase: { rpc: unknown } }) {
  const db = await admin();
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", context.userId);
  if ((roles ?? []).some((r) => r.role === "admin")) return;
  const { data: pos } = await db
    .from("positions")
    .select("id, name")
    .in("name", ["Producteur général", "Producteur délégué"]);
  const ids = (pos ?? []).map((p) => p.id);
  const { data: mine } = await db
    .from("profile_positions")
    .select("position_id")
    .eq("profile_id", context.userId)
    .in("position_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if ((mine ?? []).length === 0) throw new Error("Accès réservé au Producteur général.");
}

export type RequesterDetail = {
  requestId: string;
  email: string;
  fullName: string;
  positions: string[];
  active: boolean;
  mustChangePassword: boolean;
};

/** Fiche complète des demandeurs : nom, poste et identifiant de connexion. */
export const requesterDetails = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { requestIds: string[] }) => d)
  .handler(async ({ data, context }): Promise<RequesterDetail[]> => {
    await assertHelper(context as never);
    if (data.requestIds.length === 0) return [];
    const db = await admin();
    const { data: reqs } = await db
      .from("password_requests")
      .select("id, requester_id, requester_email")
      .in("id", data.requestIds);
    const out: RequesterDetail[] = [];
    for (const r of reqs ?? []) {
      let fullName = r.requester_email;
      let positions: string[] = [];
      let active = true;
      let mustChange = false;
      if (r.requester_id) {
        const { data: p } = await db
          .from("profiles")
          .select("full_name, email, active, must_change_password")
          .eq("id", r.requester_id)
          .maybeSingle();
        if (p) {
          fullName = p.full_name;
          active = p.active;
          mustChange = p.must_change_password;
        }
        const { data: pps } = await db
          .from("profile_positions")
          .select("rank_label, positions(name)")
          .eq("profile_id", r.requester_id);
        positions = (pps ?? []).map((pp) => {
          const name = (pp as { positions: { name: string } | null }).positions?.name ?? "";
          const rank = (pp as { rank_label: string }).rank_label;
          return rank ? `${name} (${rank})` : name;
        });
      }
      out.push({
        requestId: r.id,
        email: r.requester_email,
        fullName,
        positions,
        active,
        mustChangePassword: mustChange,
      });
    }
    return out;
  });

function makePassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const small = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return `${pick(letters, 2)}${pick(small, 4)}${pick(digits, 3)}!`;
}

/**
 * Attribue un nouveau mot de passe provisoire au membre et le renvoie en clair
 * afin que le producteur puisse le transmettre directement.
 */
export const issueTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertHelper(context as never);
    const db = await admin();
    const { data: req } = await db
      .from("password_requests")
      .select("id, requester_id, requester_email")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req?.requester_id) throw new Error("Demande introuvable.");
    const password = makePassword();
    const { error } = await db.auth.admin.updateUserById(req.requester_id, { password });
    if (error) throw new Error(error.message);
    await db
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", req.requester_id);
    return { password, email: req.requester_email };
  });

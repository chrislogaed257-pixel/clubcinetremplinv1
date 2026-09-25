import { createServerFn } from "@tanstack/react-start";
import { requireCloudAuth } from "@/lib/cloud-auth";

/** Postes autorisés à créer et supprimer un projet. */
const ALLOWED_POSITIONS = [
  "Producteur général",
  "Producteur délégué",
  "Scénariste",
  "Réalisateur",
  "Comptable / Trésorier",
];

type CreateInput = {
  title: string;
  logline: string;
  description: string;
  synopsis: string;
  synopsisLink: string;
  scriptTitle: string;
  scriptLink: string;
  budgetTitle: string;
  budgetLink: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Vérifie que l'utilisateur occupe un poste autorisé (ou est administrateur). */
async function assertAllowed(userId: string) {
  const db = await admin();
  const { data: roles } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin");
  if ((roles ?? []).length > 0) return db;
  const { data: pps } = await db
    .from("profile_positions")
    .select("positions!inner(name)")
    .eq("profile_id", userId);
  const names = ((pps ?? []) as { positions: { name: string } }[]).map((p) => p.positions.name);
  if (!names.some((n) => ALLOWED_POSITIONS.includes(n)))
    throw new Error("Votre poste ne permet pas de créer ou supprimer un projet.");
  return db;
}

/**
 * Crée un projet approuvé et l'inscrit en même temps dans la rubrique Idées et projets,
 * afin qu'il suive le même parcours d'approbation que les propositions extérieures.
 */
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: CreateInput) => d)
  .handler(async ({ data, context }) => {
    const db = await assertAllowed(context.userId);
    const title = data.title.trim();
    if (!title) throw new Error("Le titre du projet est obligatoire.");
    if (!data.logline.trim()) throw new Error("La logline est obligatoire.");
    if (!data.synopsis.trim() && !data.synopsisLink.trim())
      throw new Error("Ajoutez le synopsis ou son lien Google Drive.");

    const { data: profile } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: project, error } = await db
      .from("projects")
      .insert({
        title,
        description: data.description.trim(),
        logline: data.logline.trim(),
        synopsis: data.synopsis.trim(),
        synopsis_link: data.synopsisLink.trim(),
        script_title: data.scriptTitle.trim(),
        script_link: data.scriptLink.trim(),
        budget_title: data.budgetTitle.trim(),
        budget_link: data.budgetLink.trim(),
        status: "Projet approuvé",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: iErr } = await db.from("ideas").insert({
      submitter_name: profile?.full_name ?? "Membre du club",
      submitter_email: profile?.email ?? "",
      description: data.description.trim() || data.logline.trim(),
      project_title: title,
      presentation: "Projet créé en interne par la production.",
      logline: data.logline.trim(),
      synopsis: data.synopsis.trim(),
      drive_link: data.synopsisLink.trim() || data.scriptLink.trim() || null,
      origin: "interne",
      project_id: project.id,
      status: "En attente",
    });
    if (iErr) throw new Error(iErr.message);

    await notifyReviewers(
      db,
      "Nouveau projet à examiner",
      `${profile?.full_name ?? "Un membre"} a créé le projet : ${title}`,
    );

    return { ok: true, id: project.id };
  });

/** Supprime un projet ; l'idée liée est conservée mais détachée. */
export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"] || !process.env["SUPABASE_URL"]) {
      // Hébergement sans clé serveur (ex. Vercel) : la base vérifie elle-même le poste.
      const { error } = await context.supabase.rpc("soft_delete_project", {
        _project: data.projectId,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const db = await assertAllowed(context.userId);
    const { error } = await db.from("projects").delete().eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Notifie les personnes chargées de l'analyse des idées et projets. */
export async function notifyReviewers(
  db: Awaited<ReturnType<typeof admin>>,
  title: string,
  body: string,
) {
  const { data: targets } = await db
    .from("profile_positions")
    .select("profile_id, positions!inner(name)")
    .in("positions.name", [
      "Producteur général",
      "Producteur délégué",
      "Scénariste",
      "Réalisateur",
      "Directeur de production",
    ]);
  const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const ids = new Set<string>([
    ...((targets ?? []) as { profile_id: string }[]).map((t) => t.profile_id),
    ...((admins ?? []) as { user_id: string }[]).map((a) => a.user_id),
  ]);
  if (ids.size === 0) return;
  await db.from("notifications").insert(
    [...ids].map((user_id) => ({ user_id, title, body, link: "/idees" })),
  );
}

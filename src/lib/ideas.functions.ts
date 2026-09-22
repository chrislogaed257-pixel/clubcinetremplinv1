import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Submission = {
  name: string;
  email: string;
  description: string;
  driveLink?: string | undefined;
  fileName?: string | undefined;
  fileBase64?: string | undefined;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ALLOWED = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

/** Soumission publique d'une idée de film (aucun compte requis). */
export const submitIdea = createServerFn({ method: "POST" })
  .inputValidator((d: Submission) => d)
  .handler(async ({ data }) => {
    const name = data.name?.trim();
    const email = data.email?.trim();
    const description = data.description?.trim();
    if (!name || !email || !description) throw new Error("Nom, email et description sont requis.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Adresse email invalide.");
    if (!data.driveLink && !data.fileBase64)
      throw new Error("Ajoutez un fichier ou un lien Google Drive.");

    const db = await admin();
    let fileUrl: string | null = null;

    if (data.fileBase64 && data.fileName) {
      const lower = data.fileName.toLowerCase();
      if (!ALLOWED.some((e) => lower.endsWith(e)))
        throw new Error("Formats acceptés : Word, PDF ou Excel.");
      const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
      if (bytes.length > 20 * 1024 * 1024) throw new Error("Fichier trop volumineux (20 Mo max).");
      const path = `${crypto.randomUUID()}-${data.fileName.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await db.storage.from("idea-files").upload(path, bytes);
      if (error) throw new Error(error.message);
      fileUrl = path;
    }

    const { data: idea, error: iErr } = await db
      .from("ideas")
      .insert({
        submitter_name: name,
        submitter_email: email,
        description,
        drive_link: data.driveLink?.trim() || null,
        file_url: fileUrl,
      })
      .select("id, reference, public_token")
      .single();
    if (iErr) throw new Error(iErr.message);

    // Notifier Producteur général, Producteur délégué et Scénariste
    const { data: targets } = await db
      .from("profile_positions")
      .select("profile_id, positions!inner(name)")
      .in("positions.name", ["Producteur général", "Producteur délégué", "Scénariste"]);
    const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const ids = new Set<string>([
      ...((targets ?? []) as { profile_id: string }[]).map((t) => t.profile_id),
      ...((admins ?? []) as { user_id: string }[]).map((a) => a.user_id),
    ]);
    if (ids.size > 0) {
      await db.from("notifications").insert(
        [...ids].map((user_id) => ({
          user_id,
          title: "Nouvelle idée de film reçue",
          body: `${name} a soumis une idée : ${description.slice(0, 120)}`,
          link: "/idees",
        })),
      );
    }
    return {
      ok: true,
      id: idea.id,
      reference: idea.reference ?? "",
      publicToken: idea.public_token ?? "",
    };
  });

/** Lien de téléchargement temporaire du fichier d'une idée. */
export const getIdeaFileLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ideaId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: idea, error } = await context.supabase
      .from("ideas")
      .select("file_url")
      .eq("id", data.ideaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!idea?.file_url) return { url: null };
    const db = await admin();
    const { data: signed, error: sErr } = await db.storage
      .from("idea-files")
      .createSignedUrl(idea.file_url, 300);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

type FullSubmission = {
  name: string;
  email: string;
  job: string;
  experience: string;
  projectTitle: string;
  presentation: string;
  logline: string;
  synopsis: string;
  scriptText: string;
  treatment?: string | undefined;
  intentionNote: string;
  directingNote?: string | undefined;
  driveLink?: string | undefined;
  /** Lien Google Docs / Drive propre à chaque rubrique (au lieu du texte, ou en plus). */
  presentationLink?: string | undefined;
  loglineLink?: string | undefined;
  synopsisLink?: string | undefined;
  scriptLink?: string | undefined;
  intentionLink?: string | undefined;
  directingLink?: string | undefined;
};

/**
 * Dossier complet déposé en accès libre (aucun compte, aucun identifiant).
 * Obligatoires : titre, présentation, logline, synopsis, scénario et note d'intention,
 * chacun pouvant être remplacé par un lien Google Drive.
 */
export const submitIdeaFull = createServerFn({ method: "POST" })
  .inputValidator((d: FullSubmission) => d)
  .handler(async ({ data }) => {
    const name = data.name?.trim();
    const email = data.email?.trim();
    const title = data.projectTitle?.trim();
    const link = data.driveLink?.trim();
    if (!name || !email) throw new Error("Nom et email sont requis.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Adresse email invalide.");
    if (!title) throw new Error("Le titre du projet est obligatoire.");
    const need = (value: string | undefined, label: string, own?: string | undefined) => {
      if (!value?.trim() && !own?.trim() && !link)
        throw new Error(`${label} : écrivez le texte ou ajoutez un lien Google Drive.`);
    };
    need(data.presentation, "Votre présentation", data.presentationLink);
    need(data.logline, "La logline", data.loglineLink);
    need(data.synopsis, "Le synopsis", data.synopsisLink);
    need(data.scriptText, "Le scénario", data.scriptLink);
    need(data.intentionNote, "La note d'intention", data.intentionLink);

    const db = await admin();
    const description = [
      data.presentation?.trim(),
      data.logline?.trim() ? `Logline : ${data.logline.trim()}` : "",
      data.synopsis?.trim() ? `Synopsis : ${data.synopsis.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: idea, error } = await db
      .from("ideas")
      .insert({
        submitter_name: name,
        submitter_email: email,
        description: description || title,
        project_title: title,
        presentation: data.presentation?.trim() ?? "",
        submitter_job: data.job?.trim() ?? "",
        experience_level: data.experience?.trim() ?? "",
        logline: data.logline?.trim() ?? "",
        synopsis: data.synopsis?.trim() ?? "",
        treatment: data.treatment?.trim() ?? "",
        intention_note: data.intentionNote?.trim() ?? "",
        directing_note: data.directingNote?.trim() ?? "",
        script_text: data.scriptText?.trim() ?? "",
        drive_link: link || null,
        presentation_link: data.presentationLink?.trim() ?? "",
        logline_link: data.loglineLink?.trim() ?? "",
        synopsis_link: data.synopsisLink?.trim() ?? "",
        script_link: data.scriptLink?.trim() ?? "",
        intention_link: data.intentionLink?.trim() ?? "",
        directing_link: data.directingLink?.trim() ?? "",
        origin: "externe",
      })
      .select("id, reference, public_token")
      .single();
    if (error) throw new Error(error.message);

    const { notifyReviewers } = await import("@/lib/projects.functions");
    await notifyReviewers(
      db,
      "Nouveau dossier de projet reçu",
      `${name} a déposé le projet : ${title}`,
    );

    return {
      ok: true,
      id: idea.id,
      reference: idea.reference ?? "",
      publicToken: idea.public_token ?? "",
      projectTitle: title,
      submitterName: name,
      message:
        "Merci du fond du coeur pour la confiance que vous accordez au Club Ciné Tremplin. Votre dossier est bien arrivé entre les mains de la production : il sera lu avec attention et vous recevrez une réponse par email.",
    };
  });

/**
 * Approbation directe par le Producteur général (ou le Producteur délégué / un administrateur) :
 * le dossier passe en « Projet approuvé » et rejoint immédiatement les projets approuvés.
 * Le parcours de vote existant reste inchangé.
 */
export const approveIdeaAsProducer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ideaId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: roles } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    let allowed = (roles ?? []).length > 0;
    if (!allowed) {
      const { data: pps } = await db
        .from("profile_positions")
        .select("positions!inner(name)")
        .eq("profile_id", context.userId);
      const names = ((pps ?? []) as { positions: { name: string } }[]).map((p) => p.positions.name);
      allowed = names.includes("Producteur général") || names.includes("Producteur délégué");
    }
    if (!allowed) throw new Error("Seul le Producteur général ou délégué peut approuver un dossier.");

    const { data: idea, error } = await db
      .from("ideas")
      .select("*")
      .eq("id", data.ideaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!idea) throw new Error("Dossier introuvable.");

    await db.from("ideas").update({ status: "Projet approuvé" }).eq("id", idea.id);

    const { data: existing } = await db
      .from("projects")
      .select("id")
      .eq("idea_id", idea.id)
      .maybeSingle();
    if (existing) return { ok: true, projectId: existing.id, created: false };

    const title = (idea.project_title || idea.submitter_name || "Projet").slice(0, 120);
    const { data: project, error: pErr } = await db
      .from("projects")
      .insert({
        title,
        description: idea.description ?? "",
        idea_id: idea.id,
        status: "Projet approuvé",
        origin: idea.origin === "externe" ? "externe" : "interne",
        approval_state: "approuve",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
        created_by: context.userId,
        logline: idea.logline ?? "",
        logline_link: idea.logline_link ?? "",
        synopsis: idea.synopsis ?? "",
        synopsis_link: idea.synopsis_link ?? "",
        script_link: idea.script_link ?? "",
        intention_note: idea.intention_note ?? "",
        intention_link: idea.intention_link ?? "",
        directing_note: idea.directing_note ?? "",
        directing_link: idea.directing_link ?? "",
        author_profile_id: idea.author_profile_id ?? null,
        author_name: idea.submitter_name ?? "",
        author_email: idea.submitter_email ?? "",
        author_position: idea.submitter_job ?? "",
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    await db
      .from("conversations")
      .insert({ kind: "project", title: `Projet : ${title}`, ref_id: project.id });

    const { notifyReviewers } = await import("@/lib/projects.functions");
    await notifyReviewers(db, "Projet approuvé", `Le dossier ${idea.reference ?? ""} — ${title} rejoint les projets approuvés.`);

    return { ok: true, projectId: project.id, created: true };
  });

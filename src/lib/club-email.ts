import { supabase } from "@/integrations/supabase/client";

/**
 * Journal des envois d'e-mails du club.
 * Tant qu'aucun domaine d'envoi n'est configuré, l'application n'envoie pas
 * elle-même : elle prépare le message dans la messagerie de la personne
 * (mailto) et inscrit chaque envoi dans le journal `email_log`.
 */
export type ClubMail = {
  recipient: string;
  subject: string;
  body: string;
  section: string;
  entityId?: string | null;
  template?: string;
};

export function mailtoHref(m: { recipient: string; subject: string; body: string }) {
  return `mailto:${m.recipient}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
}

export async function logClubMail(m: ClubMail, status: string, error = "") {
  const { error: err } = await supabase.from("email_log").insert({
    recipient: m.recipient,
    subject: m.subject,
    body: m.body,
    section: m.section,
    template: m.template ?? "",
    entity_id: m.entityId ?? null,
    status,
    error,
    sent_at: status === "envoye" ? new Date().toISOString() : null,
  });
  if (err) console.error("email_log", err.message);
}

/**
 * Envoi par le point d'envoi unique de l'application (mode configurable).
 * N'échoue jamais : en cas de problème, le message est inscrit « en attente »
 * dans le journal et reste disponible dans la boîte d'envoi.
 */
export async function sendAppMail(m: ClubMail) {
  try {
    const { sendAppEmail } = await import("@/lib/email.functions");
    return await sendAppEmail({ data: { ...m, entityId: m.entityId ?? null } });
  } catch (e) {
    console.error("sendAppMail", e);
    await logClubMail(m, "en_attente", e instanceof Error ? e.message : "Envoi indisponible");
    return { status: "en_attente" as const, mode: "aucun", error: "", replyTo: "" };
  }
}

/**
 * Envoi d'un message du club : il passe d'abord par le point d'envoi unique.
 * Si l'application n'envoie pas elle-même (mode « aucun » ou échec), la
 * messagerie de la personne s'ouvre avec le message prêt, comme avant.
 */
export async function sendClubMail(m: ClubMail) {
  const res = await sendAppMail(m);
  if (res.status === "envoye") return;
  if (typeof window !== "undefined") window.location.href = mailtoHref(m);
}

/** Notification interne (RPC sécurisée). */
export async function notifyProfiles(ids: string[], title: string, body: string, link: string) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return;
  const { error } = await supabase.rpc("notify_profiles", {
    _ids: clean,
    _title: title,
    _body: body,
    _link: link,
  });
  if (error) console.error("notify_profiles", error.message);
}

/** Producteur général, Producteur délégué, Réalisateur, Scénariste. */
export async function clubLeaderIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc("club_leader_ids");
  if (error) return [];
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Vérifie qu'un lien Google Docs / Drive est correctement formé. */
export function isValidLink(url: string) {
  if (!url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

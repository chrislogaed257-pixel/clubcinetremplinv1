import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Point d'envoi unique de l'application.
 * Le mode actif est lu dans `email_settings` :
 *  - `aucun` : rien ne part, le message attend dans la boîte d'envoi ;
 *  - `gmail_smtp` : envoi réel par la boîte Gmail du club ;
 *  - `domaine_verifie` : envoi par le domaine du club (à activer plus tard).
 * Dans tous les cas, l'envoi est inscrit dans `email_log` et ne bloque jamais
 * l'action qui l'a déclenché.
 */
export type SendResult = {
  status: "en_attente" | "envoye" | "echec";
  mode: string;
  error: string;
  replyTo: string;
};

export const sendAppEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      recipient: string;
      subject: string;
      body: string;
      section: string;
      entityId?: string | null;
      template?: string;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { supabase, userId } = context;

    const { data: settings } = await supabase
      .from("email_settings")
      .select("mode, reply_to, sender_name, daily_limit")
      .eq("id", "default")
      .maybeSingle();

    const mode = settings?.mode ?? "aucun";
    const senderName = settings?.sender_name || "Club Ciné Tremplin";
    const dailyLimit = settings?.daily_limit ?? 300;

    const gmailUser = process.env["GMAIL_USER"] ?? "";
    const gmailPass = process.env["GMAIL_APP_PASSWORD"] ?? "";
    const replyTo = settings?.reply_to || gmailUser;

    let status: SendResult["status"] = "en_attente";
    let error = "";

    if (mode === "gmail_smtp") {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from("email_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "envoye")
        .gte("created_at", since);

      if (!gmailUser || !gmailPass) {
        status = "echec";
        error =
          "Identifiants Gmail absents : ajoutez GMAIL_USER et GMAIL_APP_PASSWORD dans les secrets.";
      } else if ((count ?? 0) >= dailyLimit) {
        status = "en_attente";
        error = `Limite quotidienne atteinte (${dailyLimit}). Le message repart demain.`;
      } else {
        try {
          const { sendViaSmtp } = await import("./smtp.server");
          await sendViaSmtp({
            host: "smtp.gmail.com",
            port: 465,
            user: gmailUser,
            pass: gmailPass,
            from: gmailUser,
            fromName: senderName,
            replyTo: replyTo || gmailUser,
            to: data.recipient,
            subject: data.subject,
            body: data.body,
          });
          status = "envoye";
        } catch (e) {
          status = "echec";
          error = e instanceof Error ? e.message : "Envoi impossible";
        }
      }
    } else if (mode === "domaine_verifie") {
      status = "en_attente";
      error = "Domaine actif : l'envoi par le domaine reste à finaliser.";
    }

    const now = new Date().toISOString();
    await supabase.from("email_log").insert({
      recipient: data.recipient,
      subject: data.subject,
      body: data.body,
      section: data.section,
      template: data.template ?? "",
      entity_id: data.entityId ?? null,
      status,
      error,
      mode,
      reply_to: replyTo,
      attempts: mode === "aucun" ? 0 : 1,
      last_attempt_at: mode === "aucun" ? null : now,
      sent_at: status === "envoye" ? now : null,
      created_by: userId,
    });

    return { status, mode, error, replyTo };
  });

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, Mail } from "lucide-react";
import { mailtoHref } from "@/lib/club-email";
import { useEmailSettings } from "@/components/EmailModeSettings";
import { toast } from "sonner";

type Row = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  section: string;
  status: string;
  error: string;
  created_at: string;
};

/** Boîte d'envoi : messages qui n'ont pas pu partir tout seuls. */
export function EmailOutbox() {
  const qc = useQueryClient();
  const { data: settings } = useEmailSettings();

  const pending = useQuery({
    queryKey: ["email_outbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log")
        .select("id, recipient, subject, body, section, status, error, created_at")
        .in("status", ["en_attente", "echec", "ouvert_dans_messagerie"])
        .is("sent_manually_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const replyTo = settings?.reply_to ?? "";

  const fullBody = (r: Row) =>
    replyTo ? `${r.body}\n\n—\nRéponse : ${replyTo}` : r.body;

  const copy = async (r: Row) => {
    const text = `À : ${r.recipient}\nObjet : ${r.subject}\n\n${fullBody(r)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copié");
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
  };

  const markSent = async (r: Row) => {
    const { error } = await supabase
      .from("email_log")
      .update({
        status: "envoye_manuellement",
        sent_manually_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["email_outbox"] });
    qc.invalidateQueries({ queryKey: ["email_log"] });
    toast.success("Message marqué comme envoyé");
  };

  const rows = pending.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">E-mails en attente ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Copiez le message ou ouvrez-le dans votre messagerie, puis marquez-le comme envoyé.
        </p>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun message en attente.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="space-y-1 rounded border border-border p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-secondary px-2 py-0.5 text-xs">{r.section || "—"}</span>
              <span className="font-medium">{r.subject}</span>
              <span className="text-xs text-muted-foreground">{r.recipient}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("fr-FR")}
              </span>
              {r.error && <span className="text-xs text-destructive">{r.error}</span>}
            </div>
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{fullBody(r)}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(r)}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copier le message
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={mailtoHref({ ...r, body: fullBody(r) })}>
                  <Mail className="mr-1 h-3.5 w-3.5" /> Ouvrir dans ma messagerie
                </a>
              </Button>
              <Button size="sm" onClick={() => markSent(r)}>
                <Check className="mr-1 h-3.5 w-3.5" /> Marquer comme envoyé
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

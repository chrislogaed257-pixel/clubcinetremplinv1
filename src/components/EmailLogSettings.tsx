import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";
import { mailtoHref } from "@/lib/club-email";
import { toast } from "sonner";

type MailRow = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  section: string;
  status: string;
  error: string;
  created_at: string;
};

const LABEL: Record<string, string> = {
  envoye: "Envoyé",
  ouvert_dans_messagerie: "Préparé dans la messagerie",
  en_attente: "En attente",
  envoye_manuellement: "Envoyé manuellement",
  echec: "Échec",
};

/** Suivi des e-mails : qui, quoi, quand, et renvoi possible. */
export function EmailLogSettings() {
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ["email_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log")
        .select("id, recipient, subject, body, section, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MailRow[];
    },
  });

  const resend = async (row: MailRow) => {
    await supabase
      .from("email_log")
      .update({ status: "ouvert_dans_messagerie", error: "" })
      .eq("id", row.id);
    qc.invalidateQueries({ queryKey: ["email_log"] });
    window.location.href = mailtoHref(row);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Suivi des e-mails</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["email_log"] });
            toast.success("Journal actualisé");
          }}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Actualiser
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Chaque message préparé par l'application est inscrit ici. Tant qu'aucun nom de domaine
          d'envoi n'est relié au club, les messages partent depuis votre propre messagerie.
        </p>
        {(logs.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun envoi pour le moment.</p>
        )}
        {(logs.data ?? []).map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm"
          >
            <span className="rounded bg-secondary px-2 py-0.5 text-xs">{l.section || "—"}</span>
            <span className="font-medium">{l.subject}</span>
            <span className="text-xs text-muted-foreground">{l.recipient}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(l.created_at).toLocaleString("fr-FR")}
            </span>
            <span
              className={`ml-auto rounded px-2 py-0.5 text-xs ${
                l.status === "echec"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {LABEL[l.status] ?? l.status}
            </span>
            {l.error && <span className="text-xs text-destructive">{l.error}</span>}
            <Button size="sm" variant="outline" onClick={() => resend(l)}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Renvoyer
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

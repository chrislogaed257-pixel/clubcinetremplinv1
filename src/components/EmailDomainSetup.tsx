import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Globe, RefreshCw } from "lucide-react";
import { useEmailSettings } from "@/components/EmailModeSettings";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  non_configure: "Aucun domaine enregistré",
  enregistre: "Domaine enregistré — enregistrements à ajouter chez votre fournisseur",
  verifie: "Domaine vérifié — prêt à être activé",
  actif: "Domaine actif",
};

/** Écran d'aide au passage vers un domaine d'envoi du club. */
export function EmailDomainSetup() {
  const qc = useQueryClient();
  const { data } = useEmailSettings();
  const [domain, setDomain] = useState("");

  useEffect(() => {
    if (data) setDomain(data.domain);
  }, [data]);

  const status = data?.domain_status ?? "non_configure";

  const update = async (patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase
      .from("email_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", "default");
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["email_settings"] });
    toast.success(msg);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Configurer mon domaine d'envoi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Achetez un nom de domaine (par exemple cinetremplin.com) chez un fournisseur.</li>
          <li>Inscrivez-le ci-dessous et enregistrez.</li>
          <li>
            Ajoutez chez votre fournisseur les enregistrements affichés (ils vous seront donnés
            à cette étape par le service d'envoi).
          </li>
          <li>Cliquez sur « Vérifier » : le club contrôle que tout est en place.</li>
          <li>Cliquez sur « Activer » : les e-mails partent alors depuis votre domaine.</li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nom de domaine</Label>
            <Input
              value={domain}
              placeholder="cinetremplin.com"
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div>
            <Label>État</Label>
            <p className="pt-2 text-xs text-muted-foreground">
              {STATUS_LABEL[status] ?? status}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update(
                { domain: domain.trim(), domain_status: domain.trim() ? "enregistre" : "non_configure" },
                "Domaine enregistré",
              )
            }
          >
            <Globe className="mr-1 h-3.5 w-3.5" /> Enregistrer le domaine
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!data?.domain}
            onClick={() =>
              toast.info(
                "Vérification impossible tant qu'aucun domaine n'est relié au club. Prévenez-moi dès que vous en avez un.",
              )
            }
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Vérifier
          </Button>
          <Button
            size="sm"
            disabled={status !== "verifie"}
            onClick={() =>
              update({ mode: "domaine_verifie", domain_status: "actif" }, "Domaine activé")
            }
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activer
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Après activation, les messages encore en attente restent dans la boîte d'envoi : vous
          choisissez un par un ceux à envoyer ou à ignorer. Rien ne part en masse tout seul.
        </p>
      </CardContent>
    </Card>
  );
}

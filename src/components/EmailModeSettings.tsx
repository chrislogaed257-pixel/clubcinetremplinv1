import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";

export type EmailSettings = {
  id: string;
  mode: string;
  reply_to: string;
  sender_name: string;
  daily_limit: number;
  domain: string;
  domain_status: string;
  note: string;
};

export function useEmailSettings() {
  return useQuery({
    queryKey: ["email_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_settings")
        .select("id, mode, reply_to, sender_name, daily_limit, domain, domain_status, note")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EmailSettings | null;
    },
  });
}

export const MODE_LABEL: Record<string, string> = {
  aucun: "Aucun envoi automatique (boîte d'envoi)",
  gmail_smtp: "Boîte Gmail du club",
  domaine_verifie: "Domaine du club vérifié",
};

/** Mode d'envoi actif, adresse de réponse et limite quotidienne. */
export function EmailModeSettings() {
  const qc = useQueryClient();
  const { data } = useEmailSettings();
  const [form, setForm] = useState<Partial<EmailSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = async () => {
    const { error } = await supabase
      .from("email_settings")
      .update({
        mode: form.mode ?? "aucun",
        reply_to: form.reply_to ?? "",
        sender_name: form.sender_name ?? "Club Ciné Tremplin",
        daily_limit: Number(form.daily_limit ?? 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["email_settings"] });
    toast.success("Réglages d'envoi enregistrés");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Mode d'envoi des e-mails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(form.mode ?? "aucun") === "aucun" && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Aucun e-mail réel ne part : tous les messages attendent dans la boîte d'envoi
              ci-dessous.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Mode actif</Label>
            <Select
              value={form.mode ?? "aucun"}
              onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Adresse de réponse du club</Label>
            <Input
              value={form.reply_to ?? ""}
              placeholder="clubcinetremplin@gmail.com"
              onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
            />
          </div>
          <div>
            <Label>Nom affiché de l'expéditeur</Label>
            <Input
              value={form.sender_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Limite d'envois par jour</Label>
            <Input
              type="number"
              value={form.daily_limit ?? 300}
              onChange={(e) => setForm((f) => ({ ...f, daily_limit: Number(e.target.value) }))}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Les identifiants de la boîte Gmail ne sont jamais enregistrés ici : ils se saisissent
          uniquement dans les secrets du projet (GMAIL_USER et GMAIL_APP_PASSWORD).
        </p>

        <Button size="sm" onClick={save}>
          <Save className="mr-1 h-3.5 w-3.5" /> Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}

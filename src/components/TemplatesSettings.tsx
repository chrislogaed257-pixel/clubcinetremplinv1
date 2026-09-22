import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSoundPreference, setSoundEnabled } from "@/lib/sound";
import { toast } from "sonner";

type Template = { key: string; label: string; subject: string; body: string };

export function TemplatesSettings() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});

  const templates = useQuery({
    queryKey: ["message_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*").order("key");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const settings = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return (data ?? []) as { key: string; value: string }[];
    },
  });

  const soundOn =
    (settings.data ?? []).find((s) => s.key === "confirmation_sound")?.value !== "off";

  useEffect(() => {
    if (settings.data) loadSoundPreference(soundOn ? "on" : "off");
  }, [settings.data, soundOn]);

  const save = useMutation({
    mutationFn: async (t: Template) => {
      const d = drafts[t.key] ?? { subject: t.subject, body: t.body };
      const { error } = await supabase
        .from("message_templates")
        .update({ subject: d.subject, body: d.body })
        .eq("key", t.key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message_templates"] });
      toast.success("Modèle enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSound = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: value ? "on" : "off" })
        .eq("key", "confirmation_sound");
      if (error) throw error;
      setSoundEnabled(value);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🔔 Son de confirmation</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          <Switch checked={soundOn} onCheckedChange={(v) => toggleSound.mutate(v)} />
          <span className="text-muted-foreground">
            Un léger clic est joué à l'envoi d'un message ou d'une validation.
          </span>
        </CardContent>
      </Card>

      {(templates.data ?? []).map((t) => {
        const d = drafts[t.key] ?? { subject: t.subject, body: t.body };
        return (
          <Card key={t.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">✉️ {t.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor={`s-${t.key}`}>Objet</Label>
                <Input
                  id={`s-${t.key}`}
                  value={d.subject}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [t.key]: { ...d, subject: e.target.value } }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`b-${t.key}`}>Message</Label>
                <Textarea
                  id={`b-${t.key}`}
                  rows={7}
                  value={d.body}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [t.key]: { ...d, body: e.target.value } }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Champs automatiques : {"{{nom}}"}, {"{{poste}}"}, {"{{email}}"},{" "}
                {"{{mot_de_passe}}"}, {"{{lien}}"}, {"{{nom_superieur}}"}, {"{{nom_producteur}}"}
              </p>
              <Button size="sm" onClick={() => save.mutate(t)}>
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

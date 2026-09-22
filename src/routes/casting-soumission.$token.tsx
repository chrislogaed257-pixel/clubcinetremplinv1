import { PublicBrand } from "@/components/PublicBrand";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useFormFields,
  ExtraFieldsInputs,
  type ExtraValues,
} from "@/components/FormFields";
import { toast } from "sonner";

export const Route = createFileRoute("/casting-soumission/$token")({
  component: CastingSubmitPage,
  head: () => ({
    meta: [
      { title: "Candidature casting : Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Déposez votre candidature au casting d'un film du Club Ciné Tremplin : coordonnées, âge, province, quartier, langue parlée et disponibilité.",
      },
      { property: "og:title", content: "Candidature casting : Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Formulaire public de candidature au casting du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CastingSubmitPage() {
  const { token } = Route.useParams();
  const [call, setCall] = useState<{ id: string; title: string; description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: fields = [] } = useFormFields("casting");
  const [extra, setExtra] = useState<ExtraValues>({});
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    province: "",
    neighborhood: "",
    spoken_language: "",
    availability: "",
    age: "",
    link: "",
    note: "",
  });
  const [experience, setExperience] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("casting_calls")
        .select("id,title,description")
        .eq("public_token", token)
        .eq("is_open", true)
        .maybeSingle();
      setCall(data ?? null);
      setLoading(false);
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!call) return;
    setBusy(true);
    const { error } = await supabase.from("casting_applications").insert({
      call_id: call.id,
      ...form,
      cinema_experience: experience === "" ? null : experience === "Oui",
      extra,
    });
    setBusy(false);
    if (error) {
      toast.error("Envoi impossible pour le moment.");
      return;
    }
    setDone(true);
  }

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <PublicBrand />
      <Card>
        <CardHeader>
          <CardTitle>{call ? call.title : "Casting"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !call ? (
            <p className="text-sm text-muted-foreground">
              Ce casting n'est pas ouvert ou le lien n'est plus valide.
            </p>
          ) : done ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Merci pour votre candidature.</p>
              <p className="text-muted-foreground">
                Elle est bien enregistrée. La direction de casting du Club Ciné Tremplin examine
                chaque dossier et vous répondra personnellement.
              </p>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              {call.description && (
                <p className="text-sm text-muted-foreground">{call.description}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="n">Nom et prénom</Label>
                <Input id="n" value={form.full_name} onChange={set("full_name")} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="a">Âge</Label>
                  <Input id="a" value={form.age} onChange={set("age")} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pr">Province</Label>
                  <Input id="pr" value={form.province} onChange={set("province")} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c">Commune / ville</Label>
                  <Input id="c" value={form.city} onChange={set("city")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q">Quartier</Label>
                  <Input id="q" value={form.neighborhood} onChange={set("neighborhood")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p">Téléphone WhatsApp</Label>
                  <Input id="p" value={form.phone} onChange={set("phone")} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e">Email</Label>
                  <Input id="e" type="email" value={form.email} onChange={set("email")} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lg">Langue parlée</Label>
                  <Input
                    id="lg"
                    value={form.spoken_language}
                    onChange={set("spoken_language")}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="xp">Expérience en cinéma</Label>
                  <select
                    id="xp"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    required
                  >
                    <option value="">À préciser</option>
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dispo">Disponibilité</Label>
                <Input
                  id="dispo"
                  value={form.availability}
                  onChange={set("availability")}
                  placeholder="Jours et heures où vous êtes libre"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l">Lien vidéo / book (facultatif)</Label>
                <Input id="l" value={form.link} onChange={set("link")} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="no">Présentation</Label>
                <Textarea id="no" rows={4} value={form.note} onChange={set("note")} />
              </div>
              <ExtraFieldsInputs
                fields={fields}
                values={extra}
                idPrefix="casting"
                onChange={(k, v) => setExtra((prev) => ({ ...prev, [k]: v }))}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                Envoyer ma candidature
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

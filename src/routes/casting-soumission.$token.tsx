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
  const [call, setCall] = useState<{
    id: string;
    title: string;
    description: string;
    document: CallDoc | null;
  } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [shoot, setShoot] = useState<string[]>([]);
  const [rehearsal, setRehearsal] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [otherLang, setOtherLang] = useState("");
  const [presence, setPresence] = useState(false);
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
        .select("id,title,description,document")
        .eq("public_token", token)
        .eq("is_open", true)
        .maybeSingle();
      setCall((data as any) ?? null);
      setLoading(false);
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!call) return;
    const doc = call.document;
    if (doc?.roles?.length && roles.length === 0) {
      toast.error("Cochez au moins un rôle.");
      return;
    }
    const allLangs = [...langs, ...(otherLang.trim() ? [otherLang.trim()] : [])];
    setBusy(true);
    const { error } = await supabase.from("casting_applications").insert({
      call_id: call.id,
      ...form,
      spoken_language: doc ? allLangs.join(", ") || form.spoken_language : form.spoken_language,
      availability: doc
        ? [shoot.length ? `Tournage : ${shoot.join(", ")}` : "", rehearsal.length ? `Répétitions : ${rehearsal.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · ") || form.availability
        : form.availability,
      cinema_experience: experience === "" ? null : experience === "Oui",
      extra: doc
        ? {
            ...extra,
            "Rôles souhaités": roles.join(", "),
            "Disponibilité tournage": shoot.join(", "),
            "Disponibilité répétitions": rehearsal.join(", "),
            "Présence au casting": presence ? "Oui" : "Non",
            "Langues parlées": allLangs.join(", "),
          }
        : extra,
    } as any);
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
                Votre fiche est bien enregistrée. Merci de patienter : si vous êtes retenu(e), le
                Club Ciné Tremplin vous contactera par email ou par WhatsApp au numéro indiqué.
              </p>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              {call.description && (
                <p className="text-sm text-muted-foreground">{call.description}</p>
              )}
              {call.document?.schedule?.length ? (
                <div className="space-y-1 rounded border p-3 text-sm">
                  {call.document.schedule.map((x) => (
                    <p key={x.label}>
                      <span className="font-semibold uppercase">{x.label}</span> — {x.text}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-sm font-semibold">1. Vos informations</p>
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
                <div className={call.document?.languages?.length ? "hidden" : "space-y-1.5"}>
                  <Label htmlFor="lg">Langue parlée</Label>
                  <Input
                    id="lg"
                    value={form.spoken_language}
                    onChange={set("spoken_language")}
                    required={!call.document?.languages?.length}
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
              {call.document?.roles?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    2. Le rôle que vous souhaitez jouer (cochez un ou deux rôles)
                  </p>
                  {call.document.roles.map((r) => (
                    <label key={r.name} className="flex gap-2 rounded border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={roles.includes(r.name)}
                        onChange={() =>
                          setRoles((v) =>
                            v.includes(r.name)
                              ? v.filter((x) => x !== r.name)
                              : v.length >= (call.document?.max_roles ?? 2)
                                ? v
                                : [...v, r.name],
                          )
                        }
                      />
                      <span>
                        <span className="font-semibold">{r.name}</span> : {r.age}
                        <span className="block text-muted-foreground">{r.character}</span>
                        <span className="block text-xs italic text-muted-foreground">{r.line}</span>
                      </span>
                    </label>
                  ))}
                  <p className="text-sm font-semibold">3. Vos disponibilités</p>
                  <CheckGroup label="Tournage" items={call.document.shoot_days ?? []} value={shoot} onChange={setShoot} />
                  <CheckGroup label="Répétitions" items={call.document.rehearsal_days ?? []} value={rehearsal} onChange={setRehearsal} />
                  {call.document.casting_presence && (
                    <label className="flex gap-2 text-sm">
                      <input type="checkbox" checked={presence} onChange={(e) => setPresence(e.target.checked)} />
                      {call.document.casting_presence}
                    </label>
                  )}
                  <CheckGroup label="Langues parlées" items={call.document.languages ?? []} value={langs} onChange={setLangs} />
                  <Input placeholder="Autre langue" value={otherLang} onChange={(e) => setOtherLang(e.target.value)} />
                </div>
              ) : null}
              <div className={call.document?.roles?.length ? "hidden" : "space-y-1.5"}>
                <Label htmlFor="dispo">Disponibilité</Label>
                <Input
                  id="dispo"
                  value={form.availability}
                  onChange={set("availability")}
                  placeholder="Jours et heures où vous êtes libre"
                  required={!call.document?.roles?.length}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l">Lien vidéo / book (facultatif)</Label>
                <Input id="l" value={form.link} onChange={set("link")} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="no">
                  Présentation (qui êtes-vous, expérience de jeu ou de théâtre, ce qui vous motive)
                </Label>
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

type CallDoc = {
  schedule?: { label: string; text: string }[];
  roles?: { name: string; age: string; character: string; line: string }[];
  max_roles?: number;
  shoot_days?: string[];
  rehearsal_days?: string[];
  casting_presence?: string;
  languages?: string[];
};

function CheckGroup({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex flex-wrap gap-3">
        {items.map((i) => (
          <label key={i} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={value.includes(i)}
              onChange={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i])}
            />
            {i}
          </label>
        ))}
      </div>
    </div>
  );
}

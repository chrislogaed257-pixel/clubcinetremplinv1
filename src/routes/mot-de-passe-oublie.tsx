import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { lookupMember, sendPasswordRequest } from "@/lib/password.functions";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — Club Ciné Tremplin" },
      {
        name: "description",
        content: "Contactez un producteur du Club Ciné Tremplin pour retrouver votre accès.",
      },
      { property: "og:title", content: "Mot de passe oublié — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Contactez un producteur du Club Ciné Tremplin pour retrouver votre accès.",
      },
    ],
  }),
  component: ForgotPage,
});

type Producer = { position: string; name: string; email: string };
type Msg = { id: string; request_id: string; from_member: boolean; content: string; created_at: string };

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState("");
  const [producers, setProducers] = useState<Producer[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [target, setTarget] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(showToast: boolean) {
    setBusy(true);
    try {
      const res = await lookupMember({ data: { email } });
      setChecked(true);
      if (!res.found) {
        setProducers([]);
        setMessages([]);
        if (showToast) toast.error("Aucun membre ne correspond à cette adresse.");
        return;
      }
      setName(res.name);
      setProducers(res.producers);
      setMessages(res.messages as Msg[]);
      if (!target && res.producers[0]) setTarget(res.producers[0].position);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      await sendPasswordRequest({ data: { email, targetPosition: target, content } });
      setContent("");
      toast.success("Message envoyé au producteur.");
      await load(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  const chosen = producers.filter((p) => p.position === target);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <img src={logo} alt="Club Ciné Tremplin" className="mx-auto h-20 object-contain" />
          <CardTitle className="text-base">🔑 Mot de passe oublié</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="em">Votre adresse email</Label>
            <div className="flex gap-2">
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={() => load(true)} disabled={busy || !email}>
                Continuer
              </Button>
            </div>
          </div>

          {checked && producers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Si cette adresse appartient à un membre, la suite s'affichera ici. Vérifiez votre
              saisie.
            </p>
          )}

          {producers.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm">
                Bonjour {name}, choisissez le producteur à qui écrire :
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(producers.map((p) => p.position))].map((pos) => (
                  <Button
                    key={pos}
                    type="button"
                    size="sm"
                    variant={target === pos ? "default" : "outline"}
                    onClick={() => setTarget(pos)}
                  >
                    {pos}
                  </Button>
                ))}
              </div>
              {chosen.map((c) => (
                <p key={c.email} className="text-xs text-muted-foreground">
                  {c.name} — {c.email}
                </p>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="msg">Votre message</Label>
                <Textarea
                  id="msg"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Bonjour, je n'arrive plus à me connecter…"
                />
              </div>
              <Button onClick={send} disabled={busy || !content.trim() || !target}>
                Envoyer
              </Button>

              {messages.length > 0 && (
                <div className="space-y-2 rounded border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Historique</p>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                        m.from_member
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link to="/auth" className="block text-center text-xs text-muted-foreground underline">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

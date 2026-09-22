import { PublicBrand } from "@/components/PublicBrand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { acceptMentorInvite } from "@/lib/mentors.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/mentor-invitation")({
  component: MentorInvitePage,
  head: () => ({
    meta: [
      { title: "Invitation mentor — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Créez votre accès mentor externe au Club Ciné Tremplin à partir de votre code d'invitation.",
      },
      { property: "og:title", content: "Invitation mentor — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Accès réservé aux mentors invités par la production du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MentorInvitePage() {
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await acceptMentorInvite({ data: { code, email, password, fullName } });
      setDone(true);
      toast.success("Accès créé");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <PublicBrand />
      <Card>
        <CardHeader>
          <CardTitle>Accès mentor</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-3 text-sm">
              <p>Votre accès mentor est créé. Vous pouvez maintenant vous connecter.</p>
              <Link to="/auth">
                <Button className="w-full">Se connecter</Button>
              </Link>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <p className="text-sm text-muted-foreground">
                Accès libre : renseignez votre nom, votre email et un mot de passe. Le code
                d'invitation reste facultatif, uniquement si la production vous en a transmis un.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fn">Nom complet</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c">Code d'invitation (facultatif)</Label>
                <Input id="c" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e">Email</Label>
                <Input
                  id="e"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p">Mot de passe</Label>
                <Input
                  id="p"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Créer mon accès
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

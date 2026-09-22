import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/** Écran bloquant : le membre doit choisir un nouveau mot de passe. */
export function PasswordGate({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) {
      toast.error("8 caractères minimum.");
      return;
    }
    if (pass !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", userId);
    await qc.invalidateQueries({ queryKey: ["me"] });
    setBusy(false);
    toast.success("Mot de passe mis à jour");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-sm">🔑 Nouveau mot de passe requis</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <p className="text-xs text-muted-foreground">
              Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="np">Nouveau mot de passe</Label>
              <Input
                id="np"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">Confirmer</Label>
              <Input
                id="cp"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Changement de mot de passe volontaire (ancien + nouveau), depuis le profil. */
export function ChangeMyPassword({ email }: { email: string }) {
  const [oldPass, setOldPass] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) {
      toast.error("8 caractères minimum.");
      return;
    }
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: oldPass,
    });
    if (authErr) {
      setBusy(false);
      toast.error("Ancien mot de passe incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOldPass("");
    setPass("");
    toast.success("Mot de passe modifié");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🔑 Modifier mon mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="op">Ancien mot de passe</Label>
            <Input
              id="op"
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp">Nouveau mot de passe</Label>
            <Input
              id="mp"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useProfiles } from "@/hooks/useProfile";
import { useOrgContext } from "@/hooks/useOrg";
import {
  resetMemberPassword,
  setMustChangePassword,
  setMemberActive,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Comptes des membres : mots de passe, activation, désactivation. */
export function AccountsSettings() {
  const { data: profiles = [] } = useProfiles();
  const org = useOrgContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [generated, setGenerated] = useState<Record<string, string>>({});

  const reset = useServerFn(resetMemberPassword);
  const force = useServerFn(setMustChangePassword);
  const activate = useServerFn(setMemberActive);

  const refresh = () => qc.invalidateQueries({ queryKey: ["profiles"] });

  const doReset = useMutation({
    mutationFn: async ({ id, forceChange }: { id: string; forceChange: boolean }) =>
      reset({ data: { id, forceChange } }),
    onSuccess: (res, vars) => {
      setGenerated((g) => ({ ...g, [vars.id]: res.password }));
      refresh();
      toast.success("Nouveau mot de passe généré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doForce = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) =>
      force({ data: { id, value } }),
    onSuccess: () => {
      refresh();
      toast.success("Réglage enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doActivate = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      activate({ data: { id, active } }),
    onSuccess: () => {
      refresh();
      toast.success("Compte mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = profiles.filter((p) =>
    (p.full_name + " " + p.email).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🔑 Comptes & mots de passe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
        />
        <p className="text-xs text-muted-foreground">
          Un mot de passe n'est visible qu'au moment de sa génération. Copiez-le puis envoyez-le au
          membre par la messagerie « Mot de passe oublié ».
        </p>
        <div className="space-y-3">
          {list.map((p) => {
            const pass = generated[p.id];
            const inactive = p.active === false;
            return (
              <div key={p.id} className="space-y-2 rounded border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-sm">
                    {p.full_name}{" "}
                    <span className="text-xs text-muted-foreground">· {p.email}</span>
                    {inactive && (
                      <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-[10px]">
                        Désactivé
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={doReset.isPending}
                    onClick={() => doReset.mutate({ id: p.id, forceChange: true })}
                  >
                    Générer un mot de passe
                  </Button>
                  {org.isAdmin && (
                    <Button
                      size="sm"
                      variant={inactive ? "default" : "ghost"}
                      onClick={() => doActivate.mutate({ id: p.id, active: inactive })}
                    >
                      {inactive ? "Réactiver" : "Désactiver"}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch
                    id={`force-${p.id}`}
                    checked={!!(p as { must_change_password?: boolean }).must_change_password}
                    onCheckedChange={(v) => doForce.mutate({ id: p.id, value: v })}
                  />
                  <Label htmlFor={`force-${p.id}`} className="text-xs">
                    Changement de mot de passe obligatoire à la prochaine connexion
                  </Label>
                </div>
                {pass && (
                  <div className="flex flex-wrap items-center gap-2 rounded bg-secondary p-2">
                    <code className="text-sm">{pass}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(pass);
                        toast.success("Mot de passe copié");
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

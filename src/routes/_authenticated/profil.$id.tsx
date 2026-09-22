import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import {
  useOrgContext,
  positionNamesOf,
  ancestorIds,
  subordinateIds,
  useProjects,
  useProjectMembers,
} from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { ChangeMyPassword } from "@/components/PasswordGate";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profil/$id")({
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = useParams({ from: "/_authenticated/profil/$id" });
  const org = useOrgContext();
  const qc = useQueryClient();
  const profile = org.profiles.find((p) => p.id === id);
  const { data: projects = [] } = useProjects();
  const { data: projectMembers = [] } = useProjectMembers();

  const mine = id === org.myId;
  const [likes, setLikes] = useState<string | null>(null);
  const [dislikes, setDislikes] = useState<string | null>(null);
  const [roleDesc, setRoleDesc] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          likes: likes ?? profile?.likes ?? "",
          dislikes: dislikes ?? profile?.dislikes ?? "",
          role_description: roleDesc ?? profile?.role_description ?? "",
        })
        .eq("id", org.myId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profil mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!profile) {
    return (
      <AppLayout title="Fiche profil">
        <p className="text-sm text-muted-foreground">Cette fiche n'est pas accessible.</p>
      </AppLayout>
    );
  }

  const allowed =
    mine ||
    org.isAdmin ||
    subordinateIds(org.links, org.myId).includes(id) ||
    ancestorIds(org.links, org.myId).includes(id);

  const positions = positionNamesOf(id, org.profilePositions, org.positions);
  const managers = org.links.filter((l) => l.profile_id === id).map((l) => l.manager_id);
  const team = org.links.filter((l) => l.manager_id === id).map((l) => l.profile_id);
  const history = useQuery({
    queryKey: ["profile_position_history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_position_history")
        .select("*")
        .eq("profile_id", id)
        .order("started_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        position_name: string;
        rank_label: string;
        started_on: string;
        ended_on: string | null;
      }[];
    },
  });

  const myProjects = projectMembers
    .filter((pm) => pm.profile_id === id && pm.status !== "refused")
    .map((pm) => projects.find((p) => p.id === pm.project_id))
    .filter((p): p is (typeof projects)[number] => !!p);

  return (
    <AppLayout title={profile.full_name}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nom : </span>
              {profile.full_name}
            </p>
            {allowed && (
              <p>
                <span className="text-muted-foreground">Email : </span>
                {profile.email}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Poste(s) : </span>
              {positions.length ? positions.join(" · ") : profile.position || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Description du poste : </span>
              {profile.role_description || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Supérieur(s) direct(s) : </span>
              {managers.length ? managers.map(org.profileName).join(" · ") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Personnes dirigées : </span>
              {team.length ? team.map(org.profileName).join(" · ") : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🎬 Projet(s) en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {myProjects.length === 0 && (
              <p className="text-muted-foreground">Aucun projet pour le moment.</p>
            )}
            {myProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span>{p.title}</span>
                <span className="text-xs text-muted-foreground">{p.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">À propos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {allowed ? (
              <>
                <p>
                  <span className="text-muted-foreground">Une chose que tu aimes : </span>
                  {profile.likes || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Une chose que tu n'aimes pas : </span>
                  {profile.dislikes || "—"}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Informations non accessibles.</p>
            )}

            {mine && (
              <form
                className="space-y-3 border-t border-border pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="rd">Description de mon poste</Label>
                  <Textarea
                    id="rd"
                    rows={3}
                    placeholder="Ce que je fais concrètement dans le club…"
                    value={roleDesc ?? profile.role_description ?? ""}
                    onChange={(e) => setRoleDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l">Une chose que tu aimes</Label>
                  <Input
                    id="l"
                    placeholder="Le partage"
                    value={likes ?? profile.likes ?? ""}
                    onChange={(e) => setLikes(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d">Une chose que tu n'aimes pas</Label>
                  <Input
                    id="d"
                    placeholder="La malhonnêteté"
                    value={dislikes ?? profile.dislikes ?? ""}
                    onChange={(e) => setDislikes(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" disabled={save.isPending}>
                  Enregistrer
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">🎞️ Historique des postes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(history.data ?? []).length === 0 && (
              <p className="text-muted-foreground">Aucun historique enregistré.</p>
            )}
            {(history.data ?? []).map((h) => (
              <p key={h.id} className="text-xs text-muted-foreground">
                {h.position_name}
                {h.rank_label ? ` — ${h.rank_label}` : ""} · depuis le{" "}
                {new Date(h.started_on).toLocaleDateString("fr-FR")}
                {h.ended_on
                  ? ` jusqu'au ${new Date(h.ended_on).toLocaleDateString("fr-FR")}`
                  : " (en cours)"}
              </p>
            ))}
          </CardContent>
        </Card>

        {mine && (
          <div className="md:col-span-2">
            <ChangeMyPassword email={profile.email} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext , positionNamesOf } from "@/hooks/useOrg";
import { Chat, useConversation } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipes")({
  component: TeamsPage,
});

type Team = { id: string; name: string; leader_id: string };
type TeamMember = { id: string; team_id: string; profile_id: string };

function TeamsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [addMember, setAddMember] = useState("");

  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });
  const members = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  const createTeam = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .insert({ name, leader_id: org.myId })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("conversations")
        .insert({ kind: "team", title: `Équipe ${name}`, ref_id: data.id });
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Équipe créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, profile_id: addMember });
      if (error) throw error;
    },
    onSuccess: () => {
      setAddMember("");
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Membre ajouté");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const renameTeam = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      if (!newName.trim()) throw new Error("Le nom de l'équipe ne peut pas être vide.");
      const { error } = await supabase.from("teams").update({ name: newName.trim() }).eq("id", id);
      if (error) throw error;
      await supabase
        .from("conversations")
        .update({ title: `Équipe ${newName.trim()}` })
        .eq("kind", "team")
        .eq("ref_id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Nom de l'équipe modifié");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error: mErr } = await supabase.from("team_members").delete().eq("team_id", id);
      if (mErr) throw mErr;
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenTeam(null);
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Équipe supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Équipes">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Créer mon équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createTeam.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="n">Nom de l'équipe</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={createTeam.isPending}>
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {(teams.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune équipe visible.</p>
          )}
          {(teams.data ?? []).map((t) => {
            const list = (members.data ?? []).filter((m) => m.team_id === t.id);
            const isLeader = t.leader_id === org.myId || org.isDeputy;
            return (
              <Card key={t.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto space-y-1">
                      {isLeader ? (
                        <Input
                          className="w-64 font-medium"
                          defaultValue={t.name}
                          onBlur={(e) =>
                            e.target.value.trim() &&
                            e.target.value !== t.name &&
                            renameTeam.mutate({ id: t.id, newName: e.target.value })
                          }
                        />
                      ) : (
                        <p className="font-medium">{t.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Responsable : {org.profileName(t.leader_id)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenTeam(openTeam === t.id ? null : t.id)}
                    >
                      {openTeam === t.id ? "Fermer" : "Ouvrir"}
                    </Button>
                    {isLeader && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Supprimer l'équipe ${t.name} ?`))
                            deleteTeam.mutate(t.id);
                        }}
                      >
                        Supprimer l'équipe
                      </Button>
                    )}
                  </div>

                  {openTeam === t.id && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="space-y-1">
                        {list.length === 0 && (
                          <p className="text-sm text-muted-foreground">Aucun membre.</p>
                        )}
                        {list.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-sm">
                            <span className="mr-auto">{org.profileName(m.profile_id)}</span>
                            {isLeader && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromTeam.mutate(m.id)}
                              >
                                Retirer
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {isLeader && (
                        <div className="flex flex-wrap gap-2">
                          <Select value={addMember} onValueChange={setAddMember}>
                            <SelectTrigger className="w-60">
                              <SelectValue placeholder="Ajouter un membre" />
                            </SelectTrigger>
                            <SelectContent>
                              {org.activeProfiles
                                .filter((p) => !list.some((m) => m.profile_id === p.id))
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.full_name}
                                    {(() => {
                                      const pos = positionNamesOf(
                                        p.id,
                                        org.profilePositions,
                                        org.positions,
                                      );
                                      return pos.length ? ` — ${pos.join(", ")}` : "";
                                    })()}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" disabled={!addMember} onClick={() => addToTeam.mutate(t.id)}>
                            Ajouter
                          </Button>
                        </div>
                      )}

                      <TeamChat teamId={t.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function TeamChat({ teamId }: { teamId: string }) {
  const conv = useConversation("team", teamId);
  if (!conv.data)
    return <p className="text-sm text-muted-foreground">Discussion d'équipe indisponible.</p>;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Discussion privée de l'équipe</p>
      <Chat conversationId={conv.data.id} />
    </div>
  );
}

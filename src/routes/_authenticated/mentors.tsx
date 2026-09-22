import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MentorThread } from "@/components/MentorThread";

export const Route = createFileRoute("/_authenticated/mentors")({
  component: MentorsPage,
});

type Invite = {
  id: string;
  email: string;
  full_name: string;
  code: string;
  used_at: string | null;
  created_at: string;
  public_token: string | null;
  status: string;
};

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase();
}

function MentorsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const canManage = org.isAdmin || org.isDeputy || org.has("Producteur général");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const invites = useQuery({
    queryKey: ["mentor_invites"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("mentor_invites").insert({
        email: email.trim().toLowerCase(),
        full_name: name,
        code: randomCode(),
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["mentor_invites"] });
      toast.success("Invitation créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <AppLayout title="Mentors externes">
        <p className="text-sm text-muted-foreground">Rubrique réservée à la production.</p>
      </AppLayout>
    );
  }

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/mentor-invitation` : "/mentor-invitation";
  const openLink =
    typeof window !== "undefined" ? `${window.location.origin}/mentor-espace` : "/mentor-espace";

  return (
    <AppLayout title="Mentors externes">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Inviter un mentor</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="n">Nom</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
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
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Générer une invitation
              </Button>
              <p className="text-xs text-muted-foreground">
                Transmettez au mentor le lien <code>{link}</code> et son code.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(openLink);
                  toast.success("Lien d'accès libre copié");
                }}
              >
                Copier le lien mentor en accès libre
              </Button>
              <p className="text-xs text-muted-foreground">
                Accès libre : <code>{openLink}</code> ouvre l'espace mentor sans compte ni code.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(invites.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune invitation.</p>
          )}
          {(invites.data ?? []).map((i) => (
            <Card key={i.id}>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.full_name || i.email}</p>
                    <p className="text-xs text-muted-foreground">{i.email}</p>
                  </div>
                  <code className="rounded bg-secondary px-2 py-1 text-xs">{i.code}</code>
                  <span className="text-xs text-muted-foreground">
                    {i.used_at ? "Accès créé" : "En attente"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(`${link} : code ${i.code}`);
                      toast.success("Lien et code copiés");
                    }}
                  >
                    Copier
                  </Button>
                  {i.public_token && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${openLink}?t=${i.public_token}`);
                        toast.success("Lien personnel d'accès libre copié");
                      }}
                    >
                      Copier son lien d'échange
                    </Button>
                  )}
                </div>
                <MentorThread
                  inviteId={i.id}
                  status={i.status ?? "active"}
                  myId={org.myId}
                  mentorName={i.full_name || i.email}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

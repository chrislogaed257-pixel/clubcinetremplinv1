import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  issueTemporaryPassword,
  requesterDetails,
} from "@/lib/password-help.functions";

export const Route = createFileRoute("/_authenticated/mot-de-passe")({
  component: PasswordHelpPage,
});

type Request = {
  id: string;
  requester_email: string;
  requester_id: string | null;
  target_position: string;
  status: string;
  created_at: string;
};
type Msg = {
  id: string;
  request_id: string;
  from_member: boolean;
  content: string;
  created_at: string;
};

function PasswordHelpPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const requests = useQuery({
    queryKey: ["password_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Request[];
    },
  });

  const messages = useQuery({
    queryKey: ["password_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_messages")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const templates = useQuery({
    queryKey: ["message_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reply = useMutation({
    mutationFn: async (requestId: string) => {
      const content = (drafts[requestId] ?? "").trim();
      if (!content) throw new Error("Message vide");
      const { error } = await supabase.from("password_messages").insert({
        request_id: requestId,
        from_member: false,
        author_id: org.myId,
        content,
      });
      if (error) throw error;
      await supabase.from("password_requests").update({ status: "répondue" }).eq("id", requestId);
    },
    onSuccess: (_d, id) => {
      setDrafts((p) => ({ ...p, [id]: "" }));
      qc.invalidateQueries({ queryKey: ["password_messages"] });
      qc.invalidateQueries({ queryKey: ["password_requests"] });
      toast.success("Réponse envoyée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function suggest(r: Request) {
    const tpl = (templates.data ?? []).find((t: { key: string }) => t.key === "password_reply") as
      | { body: string }
      | undefined;
    const memberName = r.requester_id ? org.profileName(r.requester_id) : r.requester_email;
    const body = (tpl?.body ?? "Bonjour {{nom}},")
      .replace(/{{\s*nom\s*}}/g, memberName)
      .replace(/{{\s*nom_producteur\s*}}/g, org.me?.profile?.full_name ?? "");
    setDrafts((p) => ({ ...p, [r.id]: body }));
  }

  const allowed =
    org.isAdmin ||
    org.myBasePositions.includes("Producteur général") ||
    org.myBasePositions.includes("Producteur délégué");
  const mine = (requests.data ?? []).filter(
    (r) => allowed || r.requester_id === org.myId,
  );

  const details = useQuery({
    queryKey: ["password_request_details", mine.map((r) => r.id).join(",")],
    enabled: allowed && mine.length > 0,
    queryFn: () => requesterDetails({ data: { requestIds: mine.map((r) => r.id) } }),
  });

  const issue = useMutation({
    mutationFn: (requestId: string) => issueTemporaryPassword({ data: { requestId } }),
    onSuccess: (res, requestId) => {
      const info = (details.data ?? []).find((d) => d.requestId === requestId);
      setDrafts((p) => ({
        ...p,
        [requestId]:
          `Bonjour ${info?.fullName ?? ""},\n\n` +
          `Voici vos accès : identifiant ${res.email}, mot de passe provisoire ${res.password}.\n` +
          `Merci de le changer dès votre prochaine connexion.`,
      }));
      toast.success("Mot de passe provisoire créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed && mine.length === 0) {
    return (
      <AppLayout title="Mot de passe oublié">
        <p className="text-sm text-muted-foreground">Aucun message.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mot de passe oublié">
      <div className="space-y-3">
        {mine.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
        )}
        {mine.map((r) => {
          const thread = (messages.data ?? []).filter((m) => m.request_id === r.id);
          const info = (details.data ?? []).find((d) => d.requestId === r.id);
          return (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {info?.fullName ?? (r.requester_id ? org.profileName(r.requester_id) : r.requester_email)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    : {r.target_position} : {new Date(r.created_at).toLocaleString("fr-FR")} :{" "}
                    {r.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allowed && info && (
                  <div className="rounded border border-border bg-secondary/40 p-3 text-xs">
                    <p>
                      <span className="text-muted-foreground">Nom complet : </span>
                      {info.fullName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Poste : </span>
                      {info.positions.length > 0 ? info.positions.join(", ") : "Non renseigné"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Identifiant de connexion : </span>
                      {info.email}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Compte : </span>
                      {info.active ? "actif" : "désactivé"}
                      {info.mustChangePassword ? " : changement de mot de passe demandé" : ""}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Le mot de passe est chiffré et illisible : générez un mot de passe provisoire
                      à transmettre.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={issue.isPending}
                      onClick={() => issue.mutate(r.id)}
                    >
                      Générer un mot de passe provisoire
                    </Button>
                  </div>
                )}
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                      m.from_member
                        ? "bg-secondary text-foreground"
                        : "ml-auto bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {allowed && (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      rows={3}
                      value={drafts[r.id] ?? ""}
                      onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Votre réponse…"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => suggest(r)}>
                        Message proposé
                      </Button>
                      <Button size="sm" onClick={() => reply.mutate(r.id)}>
                        Envoyer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}

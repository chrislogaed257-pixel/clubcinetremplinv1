import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext, basePositionNamesOf, positionNamesOf } from "@/hooks/useOrg";
import { Chat, useConversation } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { downloadTextPdf } from "@/lib/downloads";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conges")({
  component: LeavesPage,
});

type Leave = {
  id: string;
  requester_id: string;
  start_date: string;
  return_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  validator_id: string | null;
  created_at: string;
};
type Decision = {
  id: string;
  leave_id: string;
  decider_id: string;
  decision: "approved" | "rejected";
  comment: string;
};

const statusLabel = { pending: "En attente", approved: "Approuvée", rejected: "Refusée" } as const;

function LeavesPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [back, setBack] = useState("");
  const [reason, setReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [validator, setValidator] = useState("");

  const leaves = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Leave[];
    },
  });

  const decisions = useQuery({
    queryKey: ["leave_decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_decisions").select("*");
      if (error) throw error;
      return (data ?? []) as Decision[];
    },
  });

  const daysBefore = start
    ? Math.round((new Date(start).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;
  const tooLate = daysBefore !== null && daysBefore < 3;

  const create = useMutation({
    mutationFn: async () => {
      if (tooLate)
        throw new Error("Une demande doit être introduite au moins 3 jours avant la date de début.");
      if (!validator) throw new Error("Choisissez le supérieur à qui adresser la demande.");
      const { error } = await supabase.from("leave_requests").insert({
        requester_id: org.myId,
        start_date: start,
        return_date: back,
        reason,
        validator_id: validator,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setStart("");
      setBack("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Demande envoyée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ leave, decision }: { leave: Leave; decision: Decision["decision"] }) => {
      if (!comment.trim()) throw new Error("Un commentaire est nécessaire.");
      const { error } = await supabase.from("leave_decisions").upsert(
        {
          leave_id: leave.id,
          decider_id: org.myId,
          decision,
          comment: comment.trim(),
        },
        { onConflict: "leave_id,decider_id" },
      );
      if (error) throw error;
      const { error: uErr } = await supabase
        .from("leave_requests")
        .update({ status: decision })
        .eq("id", leave.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      qc.invalidateQueries({ queryKey: ["leave_decisions"] });
      toast.success("Décision enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mine = (leaves.data ?? []).filter((l) => l.requester_id === org.myId);
  const toValidate = (leaves.data ?? []).filter((l) => l.requester_id !== org.myId);

  const validators = org.activeProfiles.filter((p) => {
    if (p.id === org.myId) return false;
    const isDirectManager = org.links.some(
      (l) => l.profile_id === org.myId && l.manager_id === p.id,
    );
    const names = basePositionNamesOf(p.id, org.profilePositions, org.positions);
    return (
      isDirectManager ||
      names.includes("Producteur général") ||
      names.includes("Producteur délégué")
    );
  });

  return (
    <AppLayout title="Mes congés">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Nouvelle demande</CardTitle>
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
                <Label htmlFor="s">Date de début</Label>
                <Input id="s" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r">Date de retour</Label>
                <Input id="r" type="date" value={back} onChange={(e) => setBack(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m">Motif</Label>
                <Textarea id="m" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Demande adressée à</Label>
                <Select value={validator} onValueChange={setValidator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un supérieur" />
                  </SelectTrigger>
                  <SelectContent>
                    {validators.map((p) => {
                      const postes = positionNamesOf(p.id, org.profilePositions, org.positions);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                          {postes.length ? ` : ${postes.join(", ")}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {tooLate && (
                <p className="text-xs text-destructive">
                  Trop tard : la demande doit être introduite au moins 3 jours avant le début.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={create.isPending || tooLate}>
                Envoyer la demande
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Mes demandes</h2>
            {mine.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande.</p>}
            {mine.map((l) => (
              <LeaveCard
                key={l.id}
                leave={l}
                decisions={(decisions.data ?? []).filter((d) => d.leave_id === l.id)}
                org={org}
                canDecide={false}
                open={openId === l.id}
                onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                comment={comment}
                setComment={setComment}
                onDecide={decide.mutate}
              />
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Demandes à traiter</h2>
            {toValidate.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune demande à traiter.</p>
            )}
            {toValidate.map((l) => (
              <LeaveCard
                key={l.id}
                leave={l}
                decisions={(decisions.data ?? []).filter((d) => d.leave_id === l.id)}
                org={org}
                canDecide
                open={openId === l.id}
                onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                comment={comment}
                setComment={setComment}
                onDecide={decide.mutate}
              />
            ))}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function LeaveCard({
  leave,
  decisions,
  org,
  canDecide,
  open,
  onToggle,
  comment,
  setComment,
  onDecide,
}: {
  leave: Leave;
  decisions: Decision[];
  org: ReturnType<typeof useOrgContext>;
  canDecide: boolean;
  open: boolean;
  onToggle: () => void;
  comment: string;
  setComment: (v: string) => void;
  onDecide: (v: { leave: Leave; decision: Decision["decision"] }) => void;
}) {
  const conv = useConversation("leave", leave.id);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {org.profileName(leave.requester_id)}
              {leave.validator_id && (
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  → adressée à {org.profileName(leave.validator_id)}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Du {new Date(leave.start_date).toLocaleDateString("fr-FR")} au{" "}
              {new Date(leave.return_date).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1 text-sm">{leave.reason}</p>
          </div>
          <span className="rounded bg-secondary px-2 py-1 text-xs">{statusLabel[leave.status]}</span>
          {decisions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadTextPdf({
                  title: "Attestation de décision de congé",
                  subtitle: `${org.profileName(leave.requester_id)} — ${statusLabel[leave.status]}`,
                  fileName: `attestation-conge-${org.profileName(leave.requester_id)}`,
                  blocks: [
                    {
                      label: "Période",
                      text: `Du ${new Date(leave.start_date).toLocaleDateString("fr-FR")} au ${new Date(leave.return_date).toLocaleDateString("fr-FR")}`,
                    },
                    { label: "Motif", text: leave.reason || "—" },
                    ...decisions.map((d) => ({
                      label: `Décision de ${org.profileName(d.decider_id)}`,
                      text: `${d.decision === "approved" ? "Approuvée" : "Refusée"} : ${d.comment}`,
                    })),
                  ],
                })
              }
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Attestation (PDF)
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onToggle}>
            {open ? "Fermer" : "Détails"}
          </Button>
        </div>

        {open && (
          <div className="space-y-3 border-t border-border pt-3">
            {decisions.length > 0 && (
              <div className="space-y-1">
                {decisions.map((d) => (
                  <p key={d.id} className="text-xs text-muted-foreground">
                    {org.profileName(d.decider_id)} —{" "}
                    {d.decision === "approved" ? "Approuvée" : "Refusée"} : {d.comment}
                  </p>
                ))}
              </div>
            )}
            {canDecide && (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Commentaire (obligatoire)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onDecide({ leave, decision: "approved" })}>
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDecide({ leave, decision: "rejected" })}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            )}
            {conv.data && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Discussion de décision</p>
                <Chat conversationId={conv.data.id} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

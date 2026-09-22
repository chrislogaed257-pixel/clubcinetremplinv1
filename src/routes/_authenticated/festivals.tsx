import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/festivals")({
  component: FestivalsPage,
});

type Festival = {
  id: string;
  name: string;
  kind: string;
  deadline: string | null;
  url: string;
  notes: string;
};

function countdown(deadline: string | null) {
  if (!deadline) return "Sans date limite";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return "Date limite dépassée";
  if (days === 0) return "Dernier jour";
  return `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`;
}

function FestivalsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const canManage = org.isAdmin || org.isDeputy || org.has("Producteur général");

  const [name, setName] = useState("");
  const [kind, setKind] = useState("festival");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const festivals = useQuery({
    queryKey: ["festivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("festivals")
        .select("*")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Festival[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("festivals").insert({
        name,
        kind,
        deadline: deadline || null,
        url,
        notes,
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setUrl("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["festivals"] });
      toast.success("Enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("festivals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["festivals"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Festivals & résidences">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        {canManage && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Ajouter</CardTitle>
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
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="festival">Festival</SelectItem>
                      <SelectItem value="residence">Résidence</SelectItem>
                      <SelectItem value="appel">Appel à projets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d">Date limite</Label>
                  <Input id="d" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="u">Lien</Label>
                  <Input id="u" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="no">Notes</Label>
                  <Textarea id="no" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(festivals.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun festival ou résidence.</p>
          )}
          {(festivals.data ?? []).map((f) => (
            <Card key={f.id} className="card-lift">
              <CardContent className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">🎞️ {f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.kind === "residence" ? "Résidence" : f.kind === "appel" ? "Appel à projets" : "Festival"}
                    {f.deadline ? ` · ${new Date(f.deadline).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  {f.notes && <p className="mt-1 text-sm">{f.notes}</p>}
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Voir l'appel
                    </a>
                  )}
                </div>
                <span className="rounded bg-secondary px-2 py-1 text-xs">{countdown(f.deadline)}</span>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                    Supprimer
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

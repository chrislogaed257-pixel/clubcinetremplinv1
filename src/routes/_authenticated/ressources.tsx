import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useMe, useProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ressources")({
  component: ResourcesPage,
});

type Resource = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  created_at: string;
};

function ResourcesPage() {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Général");
  const [search, setSearch] = useState("");

  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("resources").insert({
        author_id: me!.userId,
        title,
        description,
        url,
        category: category || "Général",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Lien ajouté");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const name = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";
  const list = (resources.data ?? []).filter((r) =>
    (r.title + r.category + r.description).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout title="Liens & documents">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Ajouter un lien</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="lt">Titre</Label>
                <Input id="lt" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lu">URL</Label>
                <Input id="lu" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lc">Projet / catégorie</Label>
                <Input id="lc" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ld">Description</Label>
                <Textarea id="ld" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={add.isPending}>
                Ajouter
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {list.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien partagé.</p>}
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                      {r.title}
                    </a>
                    <Badge variant="secondary">{r.category}</Badge>
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {name(r.author_id)} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                {(r.author_id === me?.userId || me?.isAdmin) && (
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}>
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

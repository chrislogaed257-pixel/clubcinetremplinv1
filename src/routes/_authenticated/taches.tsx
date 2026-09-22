import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
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
import { playConfirm } from "@/lib/sound";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/taches")({
  component: TasksPage,
});

type Task = {
  id: string;
  owner_id: string;
  assigned_by: string | null;
  title: string;
  description: string;
  due_date: string | null;
  status: "todo" | "doing" | "done" | "reassign";
  estimated_duration: string;
  phase_id: string | null;
  drive_link: string | null;
};
type Phase = { id: string; name: string; active: boolean; sort_order: number };

const statuses: Task["status"][] = ["todo", "doing", "done", "reassign"];
const statusLabel: Record<Task["status"], string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Terminé",
  reassign: "À réattribuer",
};

function TasksPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("me");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [duration, setDuration] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [assignTo, setAssignTo] = useState("");

  const tasks = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const phases = useQuery({
    queryKey: ["project_phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Phase[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!phaseId) throw new Error("La phase du projet est obligatoire.");
      const forSomeoneElse = !!assignTo && assignTo !== org.myId;
      const { error } = await supabase.from("tasks").insert({
        owner_id: forSomeoneElse ? assignTo : org.myId,
        assigned_by: forSomeoneElse ? org.myId : null,
        title,
        description,
        due_date: dueDate || null,
        estimated_duration: duration,
        phase_id: phaseId,
        drive_link: driveLink || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDuration("");
      setDriveLink("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      playConfirm();
      toast.success(assignTo && assignTo !== org.myId ? "Tâche attribuée" : "Tâche ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const receivedTasks = (tasks.data ?? []).filter(
    (t) => t.owner_id === org.myId && t.assigned_by && t.assigned_by !== org.myId,
  );
  const list = (tasks.data ?? []).filter((t) =>
    filter === "me" ? t.owner_id === org.myId : filter === "all" ? true : t.owner_id === filter,
  );
  const phaseName = (id: string | null) =>
    phases.data?.find((p) => p.id === id)?.name ?? null;

  return (
    <AppLayout title="Mes tâches">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Nouvelle tâche / Attribuer une tâche</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              {org.visibleIds.filter((id) => id !== org.myId).length > 0 && (
                <div className="space-y-1.5">
                  <Label>Pour qui ?</Label>
                  <Select value={assignTo || org.myId} onValueChange={setAssignTo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={org.myId}>Moi-même</SelectItem>
                      {org.visibleIds
                        .filter((id) => id !== org.myId)
                        .map((id) => (
                          <SelectItem key={id} value={id}>
                            {org.profileName(id)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="t">Titre</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d">Description</Label>
                <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Phase du projet</Label>
                <Select value={phaseId} onValueChange={setPhaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {(phases.data ?? [])
                      .filter((p) => p.active)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dur">Durée estimée</Label>
                <Input
                  id="dur"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="2 heures, 1 jour, 2 semaines…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Échéance (optionnel)</Label>
                <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dl">Lien Google Drive (optionnel)</Label>
                <Input
                  id="dl"
                  type="url"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Ajouter
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Afficher</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Mes tâches</SelectItem>
                <SelectItem value="all">Toute mon équipe</SelectItem>
                {org.visibleIds
                  .filter((id) => id !== org.myId)
                  .map((id) => (
                    <SelectItem key={id} value={id}>
                      {org.profileName(id)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {receivedTasks.length > 0 && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  📋 Tâches reçues de mes supérieurs ({receivedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {receivedTasks.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="mr-auto">
                      {t.title}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · confiée par {org.profileName(t.assigned_by!)}
                      </span>
                    </span>
                    <Select
                      value={t.status}
                      onValueChange={(v) => update.mutate({ id: t.id, status: v as Task["status"] })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {list.length === 0 && <p className="text-sm text-muted-foreground">Aucune tâche.</p>}
          {list.map((t) => {
            const mine = t.owner_id === org.myId;
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {org.profileName(t.owner_id)}
                      {phaseName(t.phase_id) ? ` · ${phaseName(t.phase_id)}` : ""}
                      {t.estimated_duration ? ` · durée estimée ${t.estimated_duration}` : ""}
                      {t.due_date
                        ? ` · échéance ${new Date(t.due_date).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                    {t.drive_link && (
                      <a
                        href={t.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-blue-400 underline"
                      >
                        Document Google Drive
                      </a>
                    )}
                  </div>
                  {mine ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={t.status}
                        onValueChange={(v) => update.mutate({ id: t.id, status: v as Task["status"] })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(t.id)}>
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {statusLabel[t.status]} (lecture seule)
                    </span>
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

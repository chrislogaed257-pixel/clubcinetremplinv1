import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext, positionNamesOf, useProjects } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/analyse")({
  component: AnalysisPage,
});

type Task = {
  id: string;
  owner_id: string;
  status: string;
  due_date: string | null;
  project_id: string | null;
};
type Report = { id: string; author_id: string };

function AnalysisPage() {
  const org = useOrgContext();
  const projects = useProjects();

  const tasks = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
  const reports = useQuery({
    queryKey: ["reports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("id, author_id");
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const ids = org.isDeputy ? org.profiles.map((p) => p.id) : org.visibleIds;
  const rows = org.profiles
    .filter((p) => ids.includes(p.id))
    .map((p) => {
      const mine = (tasks.data ?? []).filter((t) => t.owner_id === p.id);
      const done = mine.filter((t) => t.status === "done").length;
      const late = mine.filter(
        (t) => t.status !== "done" && t.due_date && t.due_date < today,
      ).length;
      const onTime = mine.length ? Math.round((1 - late / mine.length) * 100) : 100;
      return {
        id: p.id,
        name: p.full_name,
        positions: positionNamesOf(p.id, org.profilePositions, org.positions).join(", ") || "—",
        total: mine.length,
        done,
        late,
        reports: (reports.data ?? []).filter((r) => r.author_id === p.id).length,
        onTime,
      };
    });

  const projectRows = (projects.data ?? []).map((pr) => {
    const list = (tasks.data ?? []).filter((t) => t.project_id === pr.id);
    const done = list.filter((t) => t.status === "done").length;
    const late = list.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
    return {
      id: pr.id,
      title: pr.title,
      status: pr.status,
      total: list.length,
      done,
      late,
      progress: list.length ? Math.round((done / list.length) * 100) : 0,
    };
  });

  if (org.isFunder || org.isMentor) {
    return (
      <AppLayout title="Analyse de travail">
        <p className="text-sm text-muted-foreground">
          Cette rubrique est réservée aux membres du club.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Analyse de travail">
      <Tabs defaultValue="members">
        <TabsList className="print:hidden">
          <TabsTrigger value="members">Par membre</TabsTrigger>
          <TabsTrigger value="projects">Par projet</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Poste(s)</TableHead>
                    <TableHead className="text-right">Tâches</TableHead>
                    <TableHead className="text-right">Terminées</TableHead>
                    <TableHead className="text-right">En retard</TableHead>
                    <TableHead className="text-right">Rapports</TableHead>
                    <TableHead className="text-right">Respect des délais</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.positions}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.done}</TableCell>
                      <TableCell className="text-right">{r.late}</TableCell>
                      <TableCell className="text-right">{r.reports}</TableCell>
                      <TableCell className="text-right">{r.onTime}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Étape</TableHead>
                    <TableHead className="text-right">Tâches</TableHead>
                    <TableHead className="text-right">Terminées</TableHead>
                    <TableHead className="text-right">En retard</TableHead>
                    <TableHead className="text-right">Avancement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.status}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.done}</TableCell>
                      <TableCell className="text-right">{r.late}</TableCell>
                      <TableCell className="text-right">{r.progress}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-3 flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          Archiver en PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Vous voyez ici les personnes que vous supervisez. Le Producteur général et le Producteur
          délégué voient l'ensemble du club.
        </p>
      </div>
    </AppLayout>
  );
}

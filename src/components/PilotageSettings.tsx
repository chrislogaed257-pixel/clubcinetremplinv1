import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type P = {
  id: string;
  title: string;
  approval_state: string;
  deadline: string | null;
  origin: string;
  created_at: string;
};

/** Vue d'ensemble du Producteur général : études en attente, délais, activité. */
export function PilotageSettings() {
  const pending = useQuery({
    queryKey: ["pilotage_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, approval_state, deadline, origin, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const reviews = useQuery({
    queryKey: ["pilotage_reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_reviews")
        .select("project_id, reviewer_id, decision");
      if (error) throw error;
      return (data ?? []) as { project_id: string; reviewer_id: string; decision: string }[];
    },
  });

  const invites = useQuery({
    queryKey: ["pilotage_mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_invites")
        .select("id, full_name, email, status, used_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        full_name: string;
        email: string;
        status: string;
        used_at: string | null;
      }[];
    },
  });

  const activity = useQuery({
    queryKey: ["pilotage_activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_log")
        .select("id, table_name, action, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        table_name: string;
        action: string;
        summary: string;
        created_at: string;
      }[];
    },
  });

  const all = pending.data ?? [];
  const inStudy = all.filter((p) => p.approval_state === "en_etude");
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const late = all.filter((p) => p.deadline && p.deadline < today);
  const near = all.filter((p) => p.deadline && p.deadline >= today && p.deadline <= soon);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Projets en attente d'étude</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {inStudy.length === 0 && <p className="text-muted-foreground">Aucun projet en étude.</p>}
          {inStudy.map((p) => {
            const given = (reviews.data ?? []).filter((r) => r.project_id === p.id).length;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded border border-border p-2">
                <Link to="/projets-approuves" className="mr-auto underline">
                  {p.title}
                </Link>
                <span className="text-xs text-muted-foreground">{given}/4 avis rendus</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Délais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {late.length === 0 && near.length === 0 && (
            <p className="text-muted-foreground">Aucun délai proche ou dépassé.</p>
          )}
          {late.map((p) => (
            <div key={p.id} className="rounded bg-destructive/10 p-2 text-destructive">
              {p.title} — délai dépassé ({p.deadline})
            </div>
          ))}
          {near.map((p) => (
            <div key={p.id} className="rounded bg-secondary p-2">
              {p.title} — échéance le {p.deadline}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Liens des mentors externes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(invites.data ?? []).length === 0 && (
            <p className="text-muted-foreground">Aucun mentor invité.</p>
          )}
          {(invites.data ?? []).map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded border border-border p-2">
              <span className="mr-auto">
                {i.full_name} · {i.email}
              </span>
              <span className="text-xs text-muted-foreground">
                {i.used_at ? "Lien utilisé" : i.status || "en attente"}
              </span>
            </div>
          ))}
          <Link to="/mentors" className="text-xs underline">
            Gérer les mentors externes
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          {(activity.data ?? []).map((a) => (
            <p key={a.id}>
              {new Date(a.created_at).toLocaleString("fr-FR")} · {a.table_name} · {a.action} —{" "}
              {a.summary}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

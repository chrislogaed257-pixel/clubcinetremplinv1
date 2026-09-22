import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext, useProjects, positionNamesOf } from "@/hooks/useOrg";
import { PickerAdd } from "@/components/PickerInput";
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
import { downloadTextPdf } from "@/lib/downloads";
import { Download } from "lucide-react";
import {
  useFormFields,
  ExtraFieldsInputs,
  ExtraFieldsView,
  type ExtraValues,
} from "@/components/FormFields";

export const Route = createFileRoute("/_authenticated/feuille-de-service")({
  component: CallSheetsPage,
});

type CallSheet = {
  id: string;
  project_id: string | null;
  title: string;
  service_date: string;
  call_time: string;
  location: string;
  crew: string;
  notes: string;
  created_at: string;
  extra?: unknown;
};

const NONE = "none";

function CallSheetsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const projects = useProjects();
  const canManage =
    org.isAdmin || org.isDeputy || org.has("Producteur général") || org.isProductionDirector;

  const [title, setTitle] = useState("");
  const [project, setProject] = useState(NONE);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [crew, setCrew] = useState("");
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState<ExtraValues>({});
  const { data: fields = [] } = useFormFields("feuille");

  const sheets = useQuery({
    queryKey: ["call_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_sheets")
        .select("*")
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CallSheet[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("call_sheets").insert({
        title,
        project_id: project === NONE ? null : project,
        service_date: date,
        call_time: time,
        location: place,
        crew,
        notes,
        extra,
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setCrew("");
      setNotes("");
      setExtra({});
      qc.invalidateQueries({ queryKey: ["call_sheets"] });
      toast.success("Feuille de service créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.title ?? "Sans projet";

  return (
    <AppLayout title="Feuille de service">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        {canManage && (
          <Card className="h-fit print:hidden">
            <CardHeader>
              <CardTitle className="text-sm">Nouvelle feuille</CardTitle>
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
                  <Label htmlFor="t">Titre du jour</Label>
                  <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Projet</Label>
                  <Select value={project} onValueChange={setProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sans projet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sans projet</SelectItem>
                      {(projects.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="d">Date</Label>
                    <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="h">Heure de convocation</Label>
                    <Input id="h" value={time} onChange={(e) => setTime(e.target.value)} placeholder="08h00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l">Lieu</Label>
                  <Input id="l" value={place} onChange={(e) => setPlace(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c">Équipe convoquée</Label>
                  <PickerAdd
                    options={org.activeProfiles.map((p) => {
                      const post = positionNamesOf(p.id, org.profilePositions, org.positions)[0];
                      return post ? `${p.full_name} — ${post}` : p.full_name;
                    })}
                    onPick={(v) =>
                      setCrew((prev) =>
                        prev
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .includes(v)
                          ? prev
                          : prev.trim()
                            ? `${prev.trim()}\n${v}`
                            : v,
                      )
                    }
                  />
                  <Textarea id="c" rows={3} value={crew} onChange={(e) => setCrew(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n">Notes</Label>
                  <Textarea id="n" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <ExtraFieldsInputs
                  fields={fields}
                  values={extra}
                  idPrefix="feuille"
                  onChange={(k, v) => setExtra((prev) => ({ ...prev, [k]: v }))}
                />
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  Créer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
            Imprimer / enregistrer en PDF
          </Button>
          {(sheets.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune feuille de service.</p>
          )}
          {(sheets.data ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium">
                  {s.title} : {new Date(s.service_date).toLocaleDateString("fr-FR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {projectName(s.project_id)}
                  {s.call_time ? ` · convocation ${s.call_time}` : ""}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
                {s.crew && <p className="whitespace-pre-wrap">Équipe : {s.crew}</p>}
                {s.notes && <p className="whitespace-pre-wrap text-muted-foreground">{s.notes}</p>}
                <ExtraFieldsView fields={fields} values={s.extra} />
                <Button
                  size="sm"
                  variant="outline"
                  className="print:hidden"
                  onClick={() =>
                    downloadTextPdf({
                      title: `Feuille de service : ${s.title}`,
                      subtitle: `${new Date(s.service_date).toLocaleDateString("fr-FR")} — ${projectName(s.project_id)}`,
                      fileName: `feuille-de-service-${s.title}`,
                      blocks: [
                        { label: "Convocation", text: s.call_time || "—" },
                        { label: "Lieu", text: s.location || "—" },
                        { label: "Équipe convoquée", text: s.crew || "—" },
                        { label: "Notes", text: s.notes || "—" },
                      ],
                    })
                  }
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Télécharger (PDF)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

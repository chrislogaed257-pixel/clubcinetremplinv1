import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext, useProjects } from "@/hooks/useOrg";
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
import {
  useFormFields,
  ExtraFieldsInputs,
  ExtraFieldsView,
  type ExtraValues,
} from "@/components/FormFields";

export const Route = createFileRoute("/_authenticated/contrats")({
  component: ContractsPage,
});

type Contract = {
  id: string;
  project_id: string | null;
  profile_id: string;
  role_title: string;
  terms: string;
  start_date: string | null;
  end_date: string | null;
  amount: number;
  status: string;
  created_at: string;
  extra?: unknown;
};

const NONE = "none";

function ContractsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const projects = useProjects();
  const canManage = org.isAdmin || org.isDeputy || org.has("Producteur général");

  const [member, setMember] = useState(NONE);
  const [project, setProject] = useState(NONE);
  const [roleTitle, setRoleTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState<ExtraValues>({});
  const { data: fields = [] } = useFormFields("contrat");

  const contracts = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contract[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (member === NONE) throw new Error("Choisissez un membre.");
      const { error } = await supabase.from("contracts").insert({
        profile_id: member,
        project_id: project === NONE ? null : project,
        role_title: roleTitle,
        terms,
        start_date: start || null,
        end_date: end || null,
        amount: Number(amount || 0),
        extra,
        status: "draft",
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRoleTitle("");
      setTerms("");
      setAmount("");
      setExtra({});
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.title ?? "Sans projet";

  return (
    <AppLayout title="Contrats">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        {canManage && (
          <Card className="h-fit print:hidden">
            <CardHeader>
              <CardTitle className="text-sm">Nouveau contrat</CardTitle>
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
                  <Label>Membre</Label>
                  <Select value={member} onValueChange={setMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {org.activeProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-1.5">
                  <Label htmlFor="rt">Fonction</Label>
                  <Input id="rt" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sd">Début</Label>
                    <Input id="sd" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ed">Fin</Label>
                    <Input id="ed" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am">Montant</Label>
                  <Input id="am" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="te">Conditions</Label>
                  <Textarea id="te" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
                <ExtraFieldsInputs
                  fields={fields}
                  values={extra}
                  idPrefix="contrat"
                  onChange={(k, v) => setExtra((prev) => ({ ...prev, [k]: v }))}
                />
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  Créer le contrat
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="print:hidden"
            onClick={() => window.print()}
          >
            Imprimer / enregistrer en PDF
          </Button>
          {(contracts.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun contrat.</p>
          )}
          {(contracts.data ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {org.profileName(c.profile_id)} : {c.role_title || "Fonction à préciser"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {projectName(c.project_id)}
                      {c.start_date
                        ? ` · du ${new Date(c.start_date).toLocaleDateString("fr-FR")}`
                        : ""}
                      {c.end_date ? ` au ${new Date(c.end_date).toLocaleDateString("fr-FR")}` : ""}
                      {Number(c.amount) > 0
                        ? ` · ${Number(c.amount).toLocaleString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded bg-secondary px-2 py-1 text-xs">
                    {c.status === "draft"
                      ? "Brouillon"
                      : c.status === "signed"
                        ? "Signé"
                        : "Archivé"}
                  </span>
                </div>
                {c.terms && <p className="whitespace-pre-wrap text-sm">{c.terms}</p>}
                <ExtraFieldsView fields={fields} values={c.extra} />
                <Button
                  size="sm"
                  variant="outline"
                  className="print:hidden"
                  onClick={() =>
                    downloadTextPdf({
                      title: `Contrat : ${org.profileName(c.profile_id)}`,
                      subtitle: `${c.role_title || "Fonction à préciser"} — ${projectName(c.project_id)}`,
                      fileName: `contrat-${org.profileName(c.profile_id)}`,
                      blocks: [
                        {
                          label: "Période",
                          text: `${c.start_date ? new Date(c.start_date).toLocaleDateString("fr-FR") : "—"} au ${c.end_date ? new Date(c.end_date).toLocaleDateString("fr-FR") : "—"}`,
                        },
                        {
                          label: "Montant",
                          text:
                            Number(c.amount) > 0
                              ? `${Number(c.amount).toLocaleString("fr-FR")}`
                              : "—",
                        },
                        { label: "Conditions", text: c.terms || "—" },
                        {
                          label: "Statut",
                          text:
                            c.status === "draft"
                              ? "Brouillon"
                              : c.status === "signed"
                                ? "Signé"
                                : "Archivé",
                        },
                      ],
                    })
                  }
                >
                  Télécharger le contrat (PDF)
                </Button>
                {canManage && (
                  <div className="flex gap-2 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: c.id, status: "signed" })}
                    >
                      Marquer signé
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatus.mutate({ id: c.id, status: "archived" })}
                    >
                      Archiver
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplatesSettings } from "@/components/TemplatesSettings";
import { AccountsSettings } from "@/components/AccountsSettings";
import { DelaysSettings } from "@/components/DelaysSettings";
import { FormFieldsSettings } from "@/components/FormFieldsSettings";
import { CommitteeSettings } from "@/components/CommitteeSettings";
import { BrandSettings } from "@/components/BrandSettings";
import { MenuSettings } from "@/components/MenuSettings";
import { PositionRoutesSettings } from "@/components/PositionRoutesSettings";
import { DatabaseExport } from "@/components/DatabaseExport";
import { EmailLogSettings } from "@/components/EmailLogSettings";
import { EmailModeSettings } from "@/components/EmailModeSettings";
import { EmailOutbox } from "@/components/EmailOutbox";
import { EmailDomainSetup } from "@/components/EmailDomainSetup";
import { TrashSettings } from "@/components/TrashSettings";
import { PilotageSettings } from "@/components/PilotageSettings";
import { GuideSettings } from "@/components/GuideSettings";
import { PitchSettings } from "@/components/PitchSettings";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modifications")({
  component: SettingsPage,
});

const NONE = "none";

function SettingsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();

  const [posName, setPosName] = useState("");
  const [posCat, setPosCat] = useState(NONE);
  const [catName, setCatName] = useState("");
  const [phaseName, setPhaseName] = useState("");
  const [statusName, setStatusName] = useState("");
  const [statusAdvanced, setStatusAdvanced] = useState(false);
  const [expPhase, setExpPhase] = useState("");
  const [expName, setExpName] = useState("");

  const phases = useQuery({
    queryKey: ["project_phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; active: boolean; sort_order: number }[];
    },
  });
  const statuses = useQuery({
    queryKey: ["project_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_statuses").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; advanced: boolean; active: boolean }[];
    },
  });
  const expenseCats = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("phase")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; phase: string; name: string; active: boolean }[];
    },
  });

  const refresh = (key: string) => qc.invalidateQueries({ queryKey: [key] });
  const fail = (e: Error) => toast.error(e.message);

  const addPosition = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("positions").insert({
        name: posName,
        category_id: posCat === NONE ? null : posCat,
        sort_order: org.positions.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPosName("");
      refresh("positions");
      toast.success("Poste ajouté");
    },
    onError: fail,
  });

  const updatePosition = useMutation({
    mutationFn: async (p: {
      id: string;
      name?: string;
      category_id?: string | null;
      active?: boolean;
      sort_order?: number;
    }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("positions").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh("positions"),
    onError: fail,
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("position_categories")
        .insert({ name: catName, sort_order: org.categories.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setCatName("");
      refresh("position_categories");
      toast.success("Catégorie ajoutée");
    },
    onError: fail,
  });

  const updateCategory = useMutation({
    mutationFn: async (p: { id: string; name?: string; active?: boolean }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("position_categories").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh("position_categories"),
    onError: fail,
  });

  const addPhase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_phases")
        .insert({ name: phaseName, sort_order: (phases.data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setPhaseName("");
      refresh("project_phases");
      toast.success("Phase ajoutée");
    },
    onError: fail,
  });

  const togglePhase = useMutation({
    mutationFn: async (p: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("project_phases")
        .update({ active: p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => refresh("project_phases"),
    onError: fail,
  });

  const addStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_statuses").insert({
        name: statusName,
        advanced: statusAdvanced,
        sort_order: (statuses.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusName("");
      setStatusAdvanced(false);
      refresh("project_statuses");
      toast.success("Statut ajouté");
    },
    onError: fail,
  });

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; advanced?: boolean; active?: boolean }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("project_statuses").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh("project_statuses"),
    onError: fail,
  });

  const addExpenseCat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expense_categories")
        .insert({ phase: expPhase, name: expName });
      if (error) throw error;
    },
    onSuccess: () => {
      setExpName("");
      refresh("expense_categories");
      toast.success("Catégorie de dépense ajoutée");
    },
    onError: fail,
  });

  const toggleExpenseCat = useMutation({
    mutationFn: async (p: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("expense_categories")
        .update({ active: p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => refresh("expense_categories"),
    onError: fail,
  });

  if (!org.isAdmin && !org.myBasePositions.includes("Producteur général")) {
    return (
      <AppLayout title="Modifications">
        <p className="text-sm text-muted-foreground">
          Cet espace est réservé au Producteur général.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Modifications">
      <Tabs defaultValue="positions">
        <TabsList className="h-auto flex-wrap gap-1.5 p-1.5">
          <TabsTrigger value="positions">Postes</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="phases">Phases & statuts</TabsTrigger>
          <TabsTrigger value="accounting">Catégories comptables</TabsTrigger>
          <TabsTrigger value="messages">Messages & son</TabsTrigger>
          <TabsTrigger value="accounts">Comptes & mots de passe</TabsTrigger>
          <TabsTrigger value="fields">Cases des fiches</TabsTrigger>
          <TabsTrigger value="committee">Comité & rôles fonctionnels</TabsTrigger>
          <TabsTrigger value="brand">Identité visuelle</TabsTrigger>
          <TabsTrigger value="menu">Rubriques du menu</TabsTrigger>
          <TabsTrigger value="position-routes">Rubriques par poste</TabsTrigger>
          <TabsTrigger value="database">Base de données</TabsTrigger>
          <TabsTrigger value="emails">Suivi des e-mails</TabsTrigger>
          <TabsTrigger value="trash">Corbeille</TabsTrigger>
          <TabsTrigger value="pilotage">Pilotage</TabsTrigger>
          <TabsTrigger value="guide">Guide d'utilisation</TabsTrigger>
          <TabsTrigger value="pitch">Dossier de présentation</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-6">
          <GuideSettings />
        </TabsContent>

        <TabsContent value="pitch" className="mt-6">
          <PitchSettings />
        </TabsContent>

        <TabsContent value="database" className="mt-6">
          <DatabaseExport />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <div className="space-y-4">
            <EmailModeSettings />
            <EmailOutbox />
            <EmailDomainSetup />
            <EmailLogSettings />
          </div>
        </TabsContent>

        <TabsContent value="trash" className="mt-6">
          <TrashSettings />
        </TabsContent>

        <TabsContent value="pilotage" className="mt-6">
          <PilotageSettings />
        </TabsContent>




        <TabsContent value="committee" className="mt-6">
          <CommitteeSettings />
        </TabsContent>

        <TabsContent value="brand" className="mt-6">
          <BrandSettings />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <MenuSettings />
        </TabsContent>

        <TabsContent value="position-routes" className="mt-6">
          <PositionRoutesSettings />
        </TabsContent>

        <TabsContent value="fields" className="mt-6">
          <FormFieldsSettings />
        </TabsContent>

        <TabsContent value="positions" className="mt-6 grid gap-4 md:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Ajouter un poste</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPosition.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="pn">Nom du poste</Label>
                  <Input id="pn" value={posName} onChange={(e) => setPosName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select value={posCat} onValueChange={setPosCat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {org.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {org.positions.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <Input
                    className="w-64"
                    defaultValue={p.name}
                    onBlur={(e) =>
                      e.target.value !== p.name &&
                      updatePosition.mutate({ id: p.id, name: e.target.value })
                    }
                  />
                  <Input
                    className="w-20"
                    type="number"
                    defaultValue={p.sort_order}
                    onBlur={(e) =>
                      updatePosition.mutate({ id: p.id, sort_order: Number(e.target.value) })
                    }
                  />
                  <Select
                    value={p.category_id ?? NONE}
                    onValueChange={(v) =>
                      updatePosition.mutate({ id: p.id, category_id: v === NONE ? null : v })
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {org.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      checked={p.active}
                      onCheckedChange={(v) => updatePosition.mutate({ id: p.id, active: v })}
                    />
                    <span className="text-xs text-muted-foreground">Actif</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-6 grid gap-4 md:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Ajouter une catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCategory.mutate();
                }}
              >
                <Input value={catName} onChange={(e) => setCatName(e.target.value)} required />
                <Button type="submit" className="w-full">
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {org.categories.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-2 p-3">
                  <Input
                    className="w-64"
                    defaultValue={c.name}
                    onBlur={(e) =>
                      e.target.value !== c.name &&
                      updateCategory.mutate({ id: c.id, name: e.target.value })
                    }
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) => updateCategory.mutate({ id: c.id, active: v })}
                    />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="phases" className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Phases du projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPhase.mutate();
                }}
              >
                <Input
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  placeholder="Nouvelle phase"
                  required
                />
                <Button type="submit">Ajouter</Button>
              </form>
              {(phases.data ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="mr-auto">{p.name}</span>
                  <Switch
                    checked={p.active}
                    onCheckedChange={(v) => togglePhase.mutate({ id: p.id, active: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statuts de projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addStatus.mutate();
                }}
              >
                <Input
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  placeholder="Nouveau statut"
                  required
                />
                <div className="flex items-center gap-2">
                  <Switch checked={statusAdvanced} onCheckedChange={setStatusAdvanced} />
                  <span className="text-xs text-muted-foreground">
                    Stade avancé (visible par les mentors)
                  </span>
                </div>
                <Button type="submit" size="sm">
                  Ajouter
                </Button>
              </form>
              {(statuses.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="mr-auto">{s.name}</span>
                  <span className="text-xs text-muted-foreground">Avancé</span>
                  <Switch
                    checked={s.advanced}
                    onCheckedChange={(v) => updateStatus.mutate({ id: s.id, advanced: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounting" className="mt-6 grid gap-4 md:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Ajouter une catégorie de dépense</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addExpenseCat.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="ep">Phase</Label>
                  <Input id="ep" value={expPhase} onChange={(e) => setExpPhase(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="en">Nom</Label>
                  <Input id="en" value={expName} onChange={(e) => setExpName(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {(expenseCats.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                <span className="mr-auto">
                  {c.phase} · {c.name}
                </span>
                <Switch
                  checked={c.active}
                  onCheckedChange={(v) => toggleExpenseCat.mutate({ id: c.id, active: v })}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <TemplatesSettings />
        </TabsContent>
        <TabsContent value="accounts" className="mt-6 space-y-4">
          <DelaysSettings />
          <AccountsSettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

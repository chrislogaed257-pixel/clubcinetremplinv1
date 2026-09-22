import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { logAccounting } from "@/lib/accounting";
import { ForecastExpenses } from "@/components/ForecastExpenses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { downloadCsv } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/comptabilite")({
  component: AccountingPage,
});

type Funder = {
  id: string;
  name: string;
  location: string;
  email: string;
  relation_member_id: string | null;
  contact_ref: string;
  extended_access: boolean;
};
type Contribution = {
  id: string;
  funder_id: string;
  project_id: string | null;
  amount: number;
  contributed_on: string;
  note: string;
};
type Expense = {
  id: string;
  amount: number;
  spent_on: string;
  project_id: string | null;
  category_id: string | null;
  subcategory: string;
  funder_id: string | null;
  contribution_id: string | null;
  description: string;
};
type ExpenseCategory = { id: string; phase: string; name: string; active: boolean };
type Project = { id: string; title: string };

const NONE = "none";

function AccountingPage() {
  const org = useOrgContext();
  const qc = useQueryClient();

  const funders = useQuery({
    queryKey: ["funders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funders").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Funder[];
    },
  });
  const contributions = useQuery({
    queryKey: ["contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .order("contributed_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contribution[];
    },
  });
  const expenses = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
  const categories = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("phase")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ExpenseCategory[];
    },
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title").order("title");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  // --- Formulaires
  const auditLog = useQuery({
    queryKey: ["accounting_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        actor_id: string | null;
        action: string;
        entity: string;
        detail: string;
        created_at: string;
      }[];
    },
  });

  const [fName, setFName] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fMember, setFMember] = useState(NONE);
  const [fContact, setFContact] = useState("");
  const [fUser, setFUser] = useState(NONE);

  const createFunder = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("funders")
        .insert({
          name: fName,
          location: fLocation,
          email: fEmail,
          relation_member_id: fMember === NONE ? null : fMember,
          contact_ref: fContact,
          user_id: fUser === NONE ? null : fUser,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("conversations")
        .insert({ kind: "funder", title: `Bailleur — ${fName}`, ref_id: data.id });
    },
    onSuccess: () => {
      setFName("");
      setFLocation("");
      setFEmail("");
      setFMember(NONE);
      setFUser(NONE);
      setFContact("");
      qc.invalidateQueries({ queryKey: ["funders"] });
      toast.success("Bailleur enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAccess = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("funders").update({ extended_access: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [cFunder, setCFunder] = useState(NONE);
  const [cProject, setCProject] = useState(NONE);
  const [cAmount, setCAmount] = useState("");
  const [cDate, setCDate] = useState("");
  const [cNote, setCNote] = useState("");

  const createContribution = useMutation({
    mutationFn: async () => {
      if (cFunder === NONE) throw new Error("Choisissez un bailleur.");
      const { data, error } = await supabase
        .from("contributions")
        .insert({
          funder_id: cFunder,
          project_id: cProject === NONE ? null : cProject,
          amount: Number(cAmount),
          contributed_on: cDate || new Date().toISOString().slice(0, 10),
          note: cNote,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAccounting(
        org.myId,
        "Ajout d'une contribution",
        "contribution",
        data.id,
        `${Number(cAmount).toLocaleString("fr-FR")} — ${funderName(cFunder)}`,
      );
    },
    onSuccess: () => {
      setCAmount("");
      setCNote("");
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["accounting_log"] });
      toast.success("Contribution enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState("");
  const [eProject, setEProject] = useState(NONE);
  const [eCategory, setECategory] = useState(NONE);
  const [eSub, setESub] = useState("");
  const [eFunder, setEFunder] = useState(NONE);
  const [eContribution, setEContribution] = useState(NONE);
  const [eDesc, setEDesc] = useState("");

  const createExpense = useMutation({
    mutationFn: async () => {
      if (eProject === NONE)
        throw new Error("Choisissez le projet auquel se rapporte cet enregistrement.");
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          amount: Number(eAmount),
          spent_on: eDate || new Date().toISOString().slice(0, 10),
          project_id: eProject === NONE ? null : eProject,

          category_id: eCategory === NONE ? null : eCategory,
          subcategory: eSub,
          funder_id: eFunder === NONE ? null : eFunder,
          contribution_id: eContribution === NONE ? null : eContribution,
          description: eDesc,
          created_by: org.myId,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAccounting(
        org.myId,
        "Ajout d'une dépense",
        "depense",
        data.id,
        `${Number(eAmount).toLocaleString("fr-FR")} — ${eDesc || eSub || "sans description"}`,
      );
    },
    onSuccess: () => {
      setEAmount("");
      setESub("");
      setEDesc("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["accounting_log"] });
      toast.success("Dépense enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const funderName = (id: string | null) =>
    funders.data?.find((f) => f.id === id)?.name ?? "—";
  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.title ?? "—";
  const categoryName = (id: string | null) => {
    const c = categories.data?.find((x) => x.id === id);
    return c ? `${c.phase} · ${c.name}` : "—";
  };

  return (
    <AppLayout title="Comptabilité">
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Dépenses</TabsTrigger>
          <TabsTrigger value="forecast">Dépenses prévisionnelles</TabsTrigger>

          <TabsTrigger value="funders">Bailleurs</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="trace">Traçabilité</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4 grid gap-4 md:grid-cols-[340px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Nouvelle dépense</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createExpense.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="am">Montant</Label>
                  <Input id="am" type="number" step="0.01" value={eAmount} onChange={(e) => setEAmount(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="da">Date</Label>
                  <Input id="da" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Projet concerné</Label>
                  <Select value={eProject} onValueChange={setEProject}>
                    <SelectTrigger><SelectValue placeholder="Projet" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucun</SelectItem>
                      {(projects.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Le projet est obligatoire pour un nouvel enregistrement. Les enregistrements
                    plus anciens restent valides avec la mention « sans projet ».
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select value={eCategory} onValueChange={setECategory}>
                    <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {(categories.data ?? []).filter((c) => c.active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.phase} · {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub">Sous-catégorie</Label>
                  <Input id="sub" value={eSub} onChange={(e) => setESub(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bailleur concerné</Label>
                  <Select value={eFunder} onValueChange={setEFunder}>
                    <SelectTrigger><SelectValue placeholder="Bailleur" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucun</SelectItem>
                      {(funders.data ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contribution utilisée</Label>
                  <Select value={eContribution} onValueChange={setEContribution}>
                    <SelectTrigger><SelectValue placeholder="Contribution" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {(contributions.data ?? [])
                        .filter((c) => eFunder === NONE || c.funder_id === eFunder)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {funderName(c.funder_id)} · {c.amount} ·{" "}
                            {new Date(c.contributed_on).toLocaleDateString("fr-FR")}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="de">Description</Label>
                  <Textarea id="de" rows={2} value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={createExpense.isPending}>
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "journal-depenses",
                    ["Date", "Montant", "Projet", "Description"],
                    (expenses.data ?? []).map((x) => [
                      new Date(x.spent_on).toLocaleDateString("fr-FR"),
                      String(x.amount),
                      x.project_id ? projectName(x.project_id) : "",
                      x.description ?? "",
                    ]),
                  )
                }
              >
                Télécharger les dépenses (CSV)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "journal-contributions",
                    ["Date", "Montant", "Bailleur", "Note"],
                    (contributions.data ?? []).map((c) => [
                      new Date(c.contributed_on).toLocaleDateString("fr-FR"),
                      String(c.amount),
                      funderName(c.funder_id),
                      c.note ?? "",
                    ]),
                  )
                }
              >
                Télécharger les contributions (CSV)
              </Button>
            </div>
            {(expenses.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
            )}
            {(expenses.data ?? []).map((x) => (
              <Card key={x.id}>
                <CardContent className="p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{Number(x.amount).toLocaleString("fr-FR")}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(x.spent_on).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {projectName(x.project_id)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {categoryName(x.category_id)}
                    {x.subcategory ? ` · ${x.subcategory}` : ""} · Bailleur : {funderName(x.funder_id)}
                  </p>
                  {x.description && <p className="mt-1">{x.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ForecastExpenses />
        </TabsContent>



        <TabsContent value="funders" className="mt-4 grid gap-4 md:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Nouveau bailleur</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createFunder.mutate();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="fn">Nom</Label>
                    <Input id="fn" value={fName} onChange={(e) => setFName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fl">Lieu d'habitation</Label>
                    <Input id="fl" value={fLocation} onChange={(e) => setFLocation(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fe">Email</Label>
                    <Input id="fe" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Membre en relation</Label>
                    <Select value={fMember} onValueChange={setFMember}>
                      <SelectTrigger><SelectValue placeholder="Membre" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Aucun</SelectItem>
                        {org.profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fc">Contact référent</Label>
                    <Input id="fc" value={fContact} onChange={(e) => setFContact(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Compte de connexion du bailleur</Label>
                    <Select value={fUser} onValueChange={setFUser}>
                      <SelectTrigger><SelectValue placeholder="Compte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Aucun</SelectItem>
                        {org.profiles.map((p) => (
                          <SelectItem key={`u-${p.id}`} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createFunder.isPending}>
                    Enregistrer
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Nouvelle contribution</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createContribution.mutate();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label>Bailleur</Label>
                    <Select value={cFunder} onValueChange={setCFunder}>
                      <SelectTrigger><SelectValue placeholder="Bailleur" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choisir</SelectItem>
                        {(funders.data ?? []).map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Projet financé</Label>
                    <Select value={cProject} onValueChange={setCProject}>
                      <SelectTrigger><SelectValue placeholder="Projet" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Aucun</SelectItem>
                        {(projects.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ca">Montant</Label>
                    <Input id="ca" type="number" step="0.01" value={cAmount} onChange={(e) => setCAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cd">Date</Label>
                    <Input id="cd" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cn">Note</Label>
                    <Input id="cn" value={cNote} onChange={(e) => setCNote(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createContribution.isPending}>
                    Enregistrer
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {(funders.data ?? []).map((f) => (
              <Card key={f.id}>
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.location} · {f.email} · Contact : {f.contact_ref || "—"} · Relation :{" "}
                    {f.relation_member_id ? org.profileName(f.relation_member_id) : "—"}
                  </p>
                  <p className="text-xs">
                    Total donné :{" "}
                    {(contributions.data ?? [])
                      .filter((c) => c.funder_id === f.id)
                      .reduce((s, c) => s + Number(c.amount), 0)
                      .toLocaleString("fr-FR")}
                  </p>
                  {org.isDeputy && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={f.extended_access}
                        onCheckedChange={(v) => toggleAccess.mutate({ id: f.id, value: v })}
                      />
                      <span className="text-xs text-muted-foreground">
                        Accès élargi aux données des autres bailleurs
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="journal" className="mt-4 space-y-2">
          {(contributions.data ?? []).map((c) => {
            const linked = (expenses.data ?? []).filter(
              (x) => x.contribution_id === c.id || (x.funder_id === c.funder_id && !x.contribution_id),
            );
            return (
              <Card key={c.id}>
                <CardContent className="p-4 text-sm">
                  <p className="font-medium">
                    {funderName(c.funder_id)} → {Number(c.amount).toLocaleString("fr-FR")} →{" "}
                    {projectName(c.project_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Contribution du {new Date(c.contributed_on).toLocaleDateString("fr-FR")}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                  <div className="mt-2 space-y-1">
                    {linked.length === 0 && (
                      <p className="text-xs text-muted-foreground">Aucune dépense reliée.</p>
                    )}
                    {linked.map((x) => (
                      <p key={x.id} className="text-xs">
                        → {Number(x.amount).toLocaleString("fr-FR")} ·{" "}
                        {categoryName(x.category_id)} · {projectName(x.project_id)}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="trace" className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Chaque opération est enregistrée avec son auteur, sa date et son montant. Seuls le
            Comptable / Trésorier et le Producteur général peuvent modifier la comptabilité.
          </p>
          {(auditLog.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune opération enregistrée.</p>
          )}
          {(auditLog.data ?? []).map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3 text-sm">
                <p className="font-medium">{l.action}</p>
                <p className="text-xs text-muted-foreground">
                  {org.profileName(l.actor_id ?? "")} ·{" "}
                  {new Date(l.created_at).toLocaleString("fr-FR")} · {l.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

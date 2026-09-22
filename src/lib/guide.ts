import { supabase } from "@/integrations/supabase/client";
import { FEATURE_CATALOG } from "@/lib/guide-catalog";

export type Feature = {
  id: string;
  route: string;
  name: string;
  category: string;
  description: string;
  child_explanation: string;
  purpose: string;
  how_to: string;
  owner_positions: string[];
  collaborator_positions: string[];
  links: { to: string; kind: string }[];
  status: string;
  needs_review: boolean;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ChangelogRow = {
  id: string;
  feature_name: string;
  summary: string;
  guide_version: number;
  created_at: string;
};

const VERSION_KEY = "guide_version";

/** Numéro de version courant du guide (stocké dans les réglages de l'application). */
export async function guideVersion(): Promise<number> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", VERSION_KEY)
    .maybeSingle();
  const n = Number(data?.value ?? "1");
  return Number.isFinite(n) && n > 0 ? n : 1;
}

async function setGuideVersion(n: number) {
  await supabase
    .from("app_settings")
    .upsert({ key: VERSION_KEY, value: String(n) }, { onConflict: "key" });
}

/**
 * Compare les rubriques réellement présentes avec le registre et ajoute celles qui manquent.
 * Ajout uniquement : aucune ligne existante n'est modifiée.
 */
export async function syncFeatures(): Promise<number> {
  const { data: rows, error } = await supabase.from("app_features").select("route");
  if (error) return 0;
  const known = new Set((rows ?? []).map((r) => r.route));

  type Insert = {
    route: string;
    name: string;
    category: string;
    description: string;
    child_explanation: string;
    purpose: string;
    how_to: string;
    owner_positions: string[];
    collaborator_positions: string[];
    links: { to: string; kind: string }[];
    status: string;
    needs_review: boolean;
    sort_order: number;
  };
  const inserts: Insert[] = FEATURE_CATALOG.filter(
    (f) => !known.has(f.route),
  ).map((f) => ({ ...f, status: "existante", needs_review: false }));

  const { data: menu } = await supabase.from("menu_config").select("route, label");
  for (const m of menu ?? []) {
    if (known.has(m.route)) continue;
    if (FEATURE_CATALOG.some((f) => f.route === m.route)) continue;
    if (inserts.some((i) => i.route === m.route)) continue;
    inserts.push({
      route: m.route,
      name: m.label || m.route,
      category: "Général",
      description: "à compléter",
      child_explanation: "à compléter",
      purpose: "à compléter",
      how_to: "à compléter",
      owner_positions: ["à confirmer par le Producteur général"],
      collaborator_positions: [],
      links: [],
      status: "nouvelle",
      needs_review: true,
      sort_order: 900,
    });
  }

  if (inserts.length === 0) return 0;
  const { error: insErr } = await supabase.from("app_features").insert(inserts);
  if (insErr) return 0;

  const version = (await guideVersion()) + 1;
  await setGuideVersion(version);
  await supabase.from("app_feature_changelog").insert(
    inserts.map((i) => ({
      feature_name: i.name || i.route,
      summary:
        i.status === "nouvelle"
          ? "Nouvelle rubrique détectée automatiquement — description à compléter."
          : "Rubrique inscrite au guide d'utilisation.",
      guide_version: version,
    })),
  );
  return inserts.length;
}

/** Enregistre une nouveauté dans l'historique et augmente la version du guide. */
export async function logGuideChange(opts: {
  featureId?: string | null;
  featureName: string;
  summary: string;
  actorId?: string | null;
  notify?: boolean;
}) {
  const version = (await guideVersion()) + 1;
  await setGuideVersion(version);
  await supabase.from("app_feature_changelog").insert({
    feature_id: opts.featureId ?? null,
    feature_name: opts.featureName,
    summary: opts.summary,
    actor_id: opts.actorId ?? null,
    guide_version: version,
  });
  if (opts.notify) {
    const { data: profiles } = await supabase.from("profiles").select("id").eq("active", true);
    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length > 0) {
      await supabase.rpc("notify_profiles", {
        _ids: ids,
        _title: "Le guide a été mis à jour",
        _body: `Voir ce qui a changé : ${opts.summary}`,
        _link: "/modifications",
      });
    }
  }
  return version;
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playConfirm } from "@/lib/sound";
import { useMe, useProfiles, type Profile } from "@/hooks/useProfile";

export type Position = {
  id: string;
  name: string;
  category_id: string | null;
  sort_order: number;
  active: boolean;
  description?: string;
};
export type Category = { id: string; name: string; sort_order: number; active: boolean };
export type ProfilePosition = {
  id: string;
  profile_id: string;
  position_id: string;
  rank_label: string;
};
export type ManagerLink = { id: string; profile_id: string; manager_id: string };

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("positions").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Position[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["position_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("position_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useProfilePositions() {
  return useQuery({
    queryKey: ["profile_positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profile_positions").select("*");
      if (error) throw error;
      return (data ?? []) as ProfilePosition[];
    },
  });
}

export type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  phase_id: string | null;
  state: string;
};
export type ProjectStatus = { id: string; name: string; sort_order: number; active: boolean };
export type ProjectMember = {
  id: string;
  project_id: string;
  profile_id: string;
  status: string;
  comment: string;
  added_by: string | null;
  created_at: string;
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, phase_id, state")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProjectStatuses() {
  return useQuery({
    queryKey: ["project_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("id, name, sort_order, active")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProjectStatus[];
    },
  });
}

export function useProjectMembers() {
  return useQuery({
    queryKey: ["project_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("*");
      if (error) throw error;
      return (data ?? []) as ProjectMember[];
    },
  });
}

export function useManagerLinks() {
  return useQuery({
    queryKey: ["profile_managers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profile_managers").select("*");
      if (error) throw error;
      return (data ?? []) as ManagerLink[];
    },
  });
}

export type ManagerPositionLink = { id: string; profile_id: string; position_id: string };

export type PositionRoute = { id: string; position_id: string; route: string };

/** Rubriques autorisées pour chaque poste (réglées dans « Modifications »). */
export function usePositionRoutes() {
  return useQuery({
    queryKey: ["position_routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("position_routes")
        .select("id, position_id, route");
      if (error) throw error;
      return (data ?? []) as PositionRoute[];
    },
    staleTime: 30000,
  });
}

/** Supérieurs enregistrés comme poste (quand personne n'occupe encore ce poste). */
export function useManagerPositionLinks() {
  return useQuery({
    queryKey: ["profile_manager_positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profile_manager_positions").select("*");
      if (error) throw error;
      return (data ?? []) as ManagerPositionLink[];
    },
  });
}

/** Tous les membres visibles : moi + tous mes subordonnés (directs et indirects). */
export function subordinateIds(links: ManagerLink[], myId: string): string[] {
  const ids = new Set<string>([myId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of links) {
      if (ids.has(l.manager_id) && !ids.has(l.profile_id)) {
        ids.add(l.profile_id);
        changed = true;
      }
    }
  }
  return [...ids];
}

export function ancestorIds(links: ManagerLink[], myId: string): string[] {
  const ids = new Set<string>();
  let frontier = [myId];
  while (frontier.length) {
    const next: string[] = [];
    for (const l of links) {
      if (frontier.includes(l.profile_id) && !ids.has(l.manager_id)) {
        ids.add(l.manager_id);
        next.push(l.manager_id);
      }
    }
    frontier = next;
  }
  return [...ids];
}

export function positionNamesOf(
  profileId: string,
  pps: ProfilePosition[],
  positions: Position[],
): string[] {
  return pps
    .filter((pp) => pp.profile_id === profileId)
    .map((pp) => {
      const po = positions.find((p) => p.id === pp.position_id);
      if (!po) return null;
      return pp.rank_label ? `${po.name} — ${pp.rank_label}` : po.name;
    })
    .filter((v): v is string => !!v);
}

export function basePositionNamesOf(
  profileId: string,
  pps: ProfilePosition[],
  positions: Position[],
): string[] {
  return pps
    .filter((pp) => pp.profile_id === profileId)
    .map((pp) => positions.find((p) => p.id === pp.position_id)?.name)
    .filter((v): v is string => !!v);
}

/** Mémoire partagée du poste actif : tout l'écran réagit au changement de poste. */
const ACTIVE_POSITION_KEY = "cct-active-position";
const activeListeners = new Set<() => void>();

export function getActivePosition(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_POSITION_KEY) ?? "";
}

export function setActivePosition(value: string) {
  if (typeof window !== "undefined") localStorage.setItem(ACTIVE_POSITION_KEY, value);
  activeListeners.forEach((l) => l());
}

function subscribeActive(listener: () => void) {
  activeListeners.add(listener);
  return () => {
    activeListeners.delete(listener);
  };
}

/** Poste actif courant (réactif). */
export function useActivePositionValue(): string {
  return useSyncExternalStore(
    subscribeActive,
    getActivePosition,
    () => "",
  );
}

/** Nom du poste sans le rang : « Régisseur — Assistant 1 » → « Régisseur ». */
function baseNameOf(label: string) {
  return (label.split(" — ")[0] ?? label).trim();
}

/** Contexte complet de l'utilisateur connecté. */
export function useOrgContext() {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const { data: positions = [] } = usePositions();
  const { data: categories = [] } = useCategories();
  const { data: profilePositions = [] } = useProfilePositions();
  const { data: links = [] } = useManagerLinks();
  const { data: positionRoutes = [] } = usePositionRoutes();
  const activePosition = useActivePositionValue();

  const myId = me?.userId ?? "";
  const myPositions = myId ? positionNamesOf(myId, profilePositions, positions) : [];
  const allBasePositions = myId ? basePositionNamesOf(myId, profilePositions, positions) : [];

  // Un membre à plusieurs postes n'utilise que les droits du poste qu'il a choisi.
  const restricted =
    myPositions.length > 1 && !!activePosition && myPositions.includes(activePosition);
  const activeBase = restricted ? baseNameOf(activePosition) : "";
  const myBasePositions = restricted
    ? allBasePositions.filter((p) => p === activeBase)
    : allBasePositions;

  const isAdmin =
    !!me?.isAdmin && (!restricted || activeBase === "Producteur général");
  const has = (name: string) => isAdmin || myBasePositions.includes(name);

  const visibleIds = myId
    ? isAdmin
      ? profiles.map((p) => p.id)
      : subordinateIds(links, myId)
    : [];

  // Poste actif : sa fiche et sa description suivent automatiquement le choix du membre.
  const activePositionRow =
    positions.find((p) => p.name === (restricted ? activeBase : allBasePositions[0])) ?? null;
  const activePositionDescription = activePositionRow?.description ?? "";

  // Rubriques réservées au poste choisi. Aucun réglage pour ce poste = tout reste visible.
  const allowedRoutes = activePositionRow
    ? positionRoutes.filter((r) => r.position_id === activePositionRow.id).map((r) => r.route)
    : [];
  const routeAllowed = (route: string) =>
    allowedRoutes.length === 0 || allowedRoutes.includes(route);

  return {
    me,
    myId,
    isAdmin,
    profiles,
    /** Membres encore actifs (les comptes désactivés restent dans `profiles`). */
    activeProfiles: profiles.filter((p) => p.active !== false),
    positions,
    categories,
    profilePositions,
    links,
    myPositions,
    myBasePositions,
    /** Tous les postes du membre, même quand un seul est actif. */
    allBasePositions,
    activePosition,
    /** Fiche du poste utilisé en ce moment. */
    activePositionRow,
    /** Description du poste utilisé en ce moment (renseignée dans « Postes »). */
    activePositionDescription,
    positionRoutes,
    /** Rubriques réservées au poste utilisé (vide = toutes). */
    allowedRoutes,
    routeAllowed,
    visibleIds,
    isDeputy: isAdmin || myBasePositions.includes("Producteur délégué"),
    isMentor: (me?.roles ?? []).includes("mentor"),
    isFunder: (me?.roles ?? []).includes("funder"),
    isScreenwriter: myBasePositions.includes("Scénariste"),
    isProductionDirector: myBasePositions.includes("Directeur de production"),
    canSeeIdeas:
      isAdmin ||
      ["Producteur général", "Producteur délégué", "Scénariste", "Directeur de production"].some(
        (p) => myBasePositions.includes(p),
      ),
    canVoteIdeas:
      isAdmin ||
      ["Producteur général", "Producteur délégué", "Scénariste"].some((p) =>
        myBasePositions.includes(p),
      ),
    canAccounting:
      isAdmin ||
      ["Producteur général", "Producteur délégué", "Comptable / Trésorier"].some((p) =>
        myBasePositions.includes(p),
      ),
    has,
    profileName: (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—",
  };
}

/** Poste actif choisi par un membre multi-postes (mémorisé sur l'appareil). */
export function useActivePosition(myPositions: string[]) {
  const active = useActivePositionValue();

  useEffect(() => {
    if (myPositions.length === 0) return;
    if (!active || !myPositions.includes(active)) {
      setActivePosition(myPositions[0] as string);
    }
  }, [myPositions.join("|"), active]);

  return { active, choose: setActivePosition };
}


export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient();

  // Temps réel : la cloche se met à jour dès qu'une notification arrive.
  // Le rafraîchissement périodique reste en secours.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          if (payload.eventType === "INSERT") playConfirm();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, userId]);

  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string;
        body: string;
        link: string | null;
        read_at: string | null;
        created_at: string;
      }[];
    },
  });
}

export type UnreadInfo = {
  byConversation: Record<string, number>;
  total: number;
  directTotal: number;
};

/** Compte les messages non lus par discussion (dernière consultation mémorisée). */
export function useUnread(userId: string | undefined): UnreadInfo {
  const { data } = useQuery({
    queryKey: ["unread", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      const [{ data: msgs }, { data: reads }, { data: convs }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, conversation_id, author_id, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("conversation_reads").select("conversation_id, last_read_at"),
        supabase.from("conversations").select("id, kind"),
      ]);
      const directIds = new Set((convs ?? []).filter((c) => c.kind === "direct").map((c) => c.id));
      const lastRead = new Map<string, string>();
      for (const r of reads ?? []) lastRead.set(r.conversation_id, r.last_read_at);
      const byConversation: Record<string, number> = {};
      for (const m of msgs ?? []) {
        if (m.author_id === userId) continue;
        const seen = lastRead.get(m.conversation_id);
        if (seen && new Date(seen) >= new Date(m.created_at)) continue;
        byConversation[m.conversation_id] = (byConversation[m.conversation_id] ?? 0) + 1;
      }
      return { byConversation, directIds: [...directIds] };
    },
  });
  const byConversation = data?.byConversation ?? {};
  const directIds = new Set(data?.directIds ?? []);
  return {
    byConversation,
    total: Object.values(byConversation).reduce((a, b) => a + b, 0),
    directTotal: Object.entries(byConversation)
      .filter(([id]) => directIds.has(id))
      .reduce((a, [, n]) => a + n, 0),
  };
}

/** Marque une discussion comme lue. */
export async function markConversationRead(conversationId: string, userId: string) {
  await supabase
    .from("conversation_reads")
    .upsert(
      { conversation_id: conversationId, profile_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,profile_id" },
    );
}

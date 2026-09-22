import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  position: string;
  manager_id: string | null;
  created_at: string;
  likes?: string;
  dislikes?: string;
  active?: boolean;
  must_change_password?: boolean;
  role_description?: string;
};

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        userId: user.id,
        email: user.email ?? "",
        profile: (profile ?? null) as Profile | null,
        isAdmin: (roles ?? []).some((r: { role: string }) => r.role === "admin"),
        roles: (roles ?? []).map((r: { role: string }) => r.role),
      };
    },
  });
}

/** IDs de tous les membres visibles par l'utilisateur (lui-même + ses subordonnés). */
export function visibleMemberIds(
  profiles: Profile[],
  myId: string,
  isAdmin: boolean,
): string[] {
  if (isAdmin) return profiles.map((p) => p.id);
  const ids = new Set<string>([myId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of profiles) {
      if (p.manager_id && ids.has(p.manager_id) && !ids.has(p.id)) {
        ids.add(p.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

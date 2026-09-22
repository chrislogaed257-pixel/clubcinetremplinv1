import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import {
  useOrgContext,
  positionNamesOf,
  useProjects,
  useProjectMembers,
  useManagerPositionLinks,
} from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/organigramme")({
  component: OrgChartPage,
});

function OrgChartPage() {
  const org = useOrgContext();
  const { data: projects = [] } = useProjects();
  const { data: projectMembers = [] } = useProjectMembers();
  const { data: posLinks = [] } = useManagerPositionLinks();

  const roots = org.activeProfiles.filter(
    (p) =>
      !org.links.some((l) => l.profile_id === p.id) &&
      !posLinks.some((l) => l.profile_id === p.id),
  );

  /** Postes retenus comme supérieur alors que personne ne les occupe encore. */
  const vacantPositionIds = [...new Set(posLinks.map((l) => l.position_id))];

  const childrenOf = (id: string) =>
    org.activeProfiles.filter((p) => org.links.some((l) => l.profile_id === p.id && l.manager_id === id));

  const projectsOf = (id: string) =>
    projectMembers
      .filter((pm) => pm.profile_id === id && pm.status !== "refused")
      .map((pm) => projects.find((p) => p.id === pm.project_id)?.title)
      .filter((v): v is string => !!v);

  function Node({ id, path }: { id: string; path: string[] }) {
    if (path.includes(id)) return null;
    const profile = org.profiles.find((p) => p.id === id);
    if (!profile) return null;
    const positions = positionNamesOf(id, org.profilePositions, org.positions);
    const kids = childrenOf(id);
    const mine = projectsOf(id);
    // Description de chaque poste occupé, reprise automatiquement des réglages « Postes ».
    const positionDescriptions = org.profilePositions
      .filter((pp) => pp.profile_id === id)
      .map((pp) => org.positions.find((p) => p.id === pp.position_id))
      .filter((p): p is (typeof org.positions)[number] => !!p && !!p.description)
      .map((p) => `${p.name} : ${p.description}`);

    return (
      <div className="flex flex-col items-center">
        <Link to="/profil/$id" params={{ id }} className="block w-56">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="space-y-1 p-3 text-center">
              <p className="font-medium leading-tight">{profile.full_name}</p>
              <p className="text-xs text-primary">
                {positions.length ? positions.join(" · ") : profile.position || "Poste non défini"}
              </p>
              {profile.role_description && (
                <p className="text-xs text-muted-foreground">{profile.role_description}</p>
              )}
              {positionDescriptions.map((d) => (
                <p key={d} className="text-[11px] leading-tight text-muted-foreground">
                  {d}
                </p>
              ))}
              {mine.length > 0 && (
                <p className="text-[11px] text-muted-foreground">{mine.join(" · ")}</p>
              )}
            </CardContent>
          </Card>
        </Link>

        {kids.length > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="flex flex-wrap items-start justify-center gap-6 border-t border-border pt-5">
              {kids.map((k) => (
                <Node key={`${id}-${k.id}`} id={k.id} path={[...path, id]} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <AppLayout title="🎞️ Organigramme">
      <p className="mb-6 text-sm text-muted-foreground">
        Hiérarchie générée automatiquement, du haut vers le bas. Cliquez sur une personne pour
        ouvrir sa fiche.
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max flex-wrap items-start justify-center gap-10">
          {roots.length === 0 && vacantPositionIds.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun membre.</p>
          )}
          {vacantPositionIds.map((positionId) => {
            const position = org.positions.find((p) => p.id === positionId);
            if (!position) return null;
            const kids = org.activeProfiles.filter((p) =>
              posLinks.some((l) => l.profile_id === p.id && l.position_id === positionId),
            );
            return (
              <div key={positionId} className="flex flex-col items-center">
                <Card className="w-56 border-dashed">
                  <CardContent className="space-y-1 p-3 text-center">
                    <p className="font-medium leading-tight text-primary">{position.name}</p>
                    <p className="text-xs text-muted-foreground">Poste sans titulaire</p>
                  </CardContent>
                </Card>
                {kids.length > 0 && (
                  <>
                    <div className="h-5 w-px bg-border" />
                    <div className="flex flex-wrap items-start justify-center gap-6 border-t border-border pt-5">
                      {kids.map((k) => (
                        <Node key={`${positionId}-${k.id}`} id={k.id} path={[]} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {roots.map((r) => (
            <Node key={r.id} id={r.id} path={[]} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

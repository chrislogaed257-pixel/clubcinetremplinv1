import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useProfile";
import { useNotifications, useOrgContext, useUnread } from "@/hooks/useOrg";
import { PositionSwitcher } from "@/components/PositionSwitcher";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PasswordGate } from "@/components/PasswordGate";
import { usePrefs } from "@/lib/prefs";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  Archive,
  ArrowLeft,
  Award,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Coins,
  FileSignature,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Mail,
  FolderKanban,
  Wallet,

  Menu,
  MessagesSquare,
  Moon,
  Network,
  ScrollText,
  Settings,
  Sun,
  Theater,
  Users,
  Video,
  Vote,
} from "lucide-react";

type NavItem = { to: string; label: string; Icon: ComponentType<{ className?: string }> };

const ORDER_KEY = "cct.menu.order";
const SCROLL_KEY = "cct.menu.scroll";

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { data: me } = useMe();
  const org = useOrgContext();
  const unread = useUnread(org.myId);
  const { data: notifications = [] } = useNotifications(me?.userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { lang, setLang, theme, setTheme, t } = usePrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);

  // Compte les nouveautés par rubrique à partir des notifications non lues.
  const freshByRoute: Record<string, number> = {};
  for (const n of notifications) {
    if (n.read_at || !n.link) continue;
    const base = `/${n.link.replace(/^\//, "").split(/[?#/]/)[0] ?? ""}`;
    if (base.length > 1) freshByRoute[base] = (freshByRoute[base] ?? 0) + 1;
  }
  const badgeFor = (to: string) => {
    if (to === "/messagerie") return unread.directTotal;
    if (to === "/discussion") return Math.max(unread.total - unread.directTotal, 0);
    return freshByRoute[to] ?? 0;
  };

  // Les pastilles diminuent à mesure que la personne consulte la rubrique,
  // et disparaissent quand tout a été vu. L'état est propre à chaque personne.
  const currentBase = `/${pathname.replace(/^\//, "").split("/")[0] ?? ""}`;
  const toMark = notifications
    .filter((n) => !n.read_at && n.link && n.link.startsWith(currentBase) && currentBase.length > 1)
    .map((n) => n.id);
  const markKey = toMark.join(",");
  useEffect(() => {
    if (!me?.userId || toMark.length === 0) return;
    void (async () => {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", toMark);
      await supabase
        .from("user_seen")
        .upsert(
          { profile_id: me.userId, section: currentBase, item_id: "", seen_at: new Date().toISOString() },
          { onConflict: "profile_id,section,item_id" },
        );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    })();
  }, [markKey, currentBase, me?.userId, queryClient]);



  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) setOrder(JSON.parse(raw) as string[]);
    } catch {
      /* ordre par défaut */
    }
  }, []);

  // Restaure la position exacte du menu au retour d'une rubrique.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) el.scrollTop = Number(saved);
  }, [pathname]);

  // Identité visuelle et rubriques réglables depuis « Modifications ».
  const { data: brand = [] } = useQuery({
    queryKey: ["brand_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      return (data ?? []) as { key: string; value: string }[];
    },
    staleTime: 60000,
  });
  const brandOf = (k: string, fb = "") => brand.find((s) => s.key === k)?.value || fb;
  const brandLogo = brandOf("brand_logo_url");
  const brandSlogan = brandOf("brand_slogan", "On apprend, on tourne, on décolle");
  const brandAccent = brandOf("brand_accent");

  const { data: menuConfig = [] } = useQuery({
    queryKey: ["menu_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_config").select("route, label, visible");
      if (error) throw error;
      return (data ?? []) as { route: string; label: string; visible: boolean }[];
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (!brandAccent) return;
    document.documentElement.style.setProperty("--brand-accent", brandAccent);
  }, [brandAccent]);

  // À l'ouverture : toute modification de structure faite dans Lovable est inscrite au journal.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem("cct-schema-sync") === today) return;
    sessionStorage.setItem("cct-schema-sync", today);
    void supabase.rpc("sync_schema_snapshot");
  }, []);

  // À l'ouverture : les rubriques absentes du guide y sont inscrites automatiquement.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem("cct-guide-sync") === today) return;
    sessionStorage.setItem("cct-guide-sync", today);
    void import("@/lib/guide").then((m) => m.syncFeatures());
  }, []);

  // Le Producteur général dispose des mêmes accès que l'admin technique.
  const isGeneralProducer = !!me?.isAdmin || org.myBasePositions.includes("Producteur général");

  let nav: NavItem[] = [
    { to: "/dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
    { to: "/taches", label: "Mes tâches", Icon: ClipboardList },
    { to: "/rapports", label: "Rapports", Icon: FileText },
    { to: "/conges", label: "Mes congés", Icon: CalendarDays },
    { to: "/equipes", label: "Équipes", Icon: Users },
    { to: "/organigramme", label: "Organigramme", Icon: Network },
    { to: "/ressources", label: "Liens & documents", Icon: Link2 },
    { to: "/discussion", label: "Discussions", Icon: MessagesSquare },
    { to: "/messagerie", label: "Messagerie", Icon: Mail },
    { to: "/reunions", label: "Réunions vidéo", Icon: Video },
  ];
  if (org.canSeeIdeas) {
    nav.push({ to: "/idees", label: "Idées & projets", Icon: Lightbulb });
  }
  nav.push({ to: "/nouveau-projet", label: "Déposer un projet", Icon: FileText });
  nav.push({ to: "/projets-approuves", label: "Projets approuvés", Icon: FolderKanban });
  nav.push({ to: "/budget-previsionnel", label: "Budget prévisionnel", Icon: Wallet });

  if (org.canAccounting) nav.push({ to: "/comptabilite", label: "Comptabilité", Icon: Coins });
  if (isGeneralProducer || org.myBasePositions.includes("Producteur délégué"))
    nav.push({ to: "/mot-de-passe", label: "Mot de passe oublié", Icon: KeyRound });
  nav.push({ to: "/analyse", label: "Analyse de travail", Icon: BarChart3 });
  nav.push({ to: "/contrats", label: "Contrats", Icon: FileSignature });
  nav.push({ to: "/feuille-de-service", label: "Feuille de service", Icon: Briefcase });
  nav.push({ to: "/festivals", label: "Festivals", Icon: Award });
  nav.push({ to: "/vote", label: "Vote", Icon: Vote });
  nav.push({ to: "/casting", label: "Casting", Icon: Theater });
  nav.push({ to: "/archives", label: "Archives du club", Icon: Archive });
  if (isGeneralProducer || org.isDeputy)
    nav.push({ to: "/mentors", label: "Mentors externes", Icon: GraduationCap });
  if (isGeneralProducer)
    nav.push({ to: "/journal", label: "Journal d'activité", Icon: ScrollText });
  if (isGeneralProducer) nav.push({ to: "/modifications", label: "Modifications", Icon: Settings });
  if (org.isMentor && !isGeneralProducer)
    nav = [{ to: "/mentor", label: "Espace mentor", Icon: GraduationCap }];
  if (org.isFunder && !isGeneralProducer)
    nav = [{ to: "/espace-bailleur", label: "Mon espace bailleur", Icon: Coins }];

  // Rubriques masquées ou renommées dans « Modifications ».
  if (menuConfig.length > 0) {
    nav = nav
      .filter((i) => menuConfig.find((m) => m.route === i.to)?.visible !== false)
      .map((i) => ({
        ...i,
        label: menuConfig.find((m) => m.route === i.to)?.label || i.label,
      }));
  }

  // Rubriques réservées au poste utilisé en ce moment (réglage « Rubriques par poste »).
  // Le tableau de bord reste toujours accessible.
  if (org.allowedRoutes.length > 0 && !isGeneralProducer) {
    nav = nav.filter((i) => i.to === "/dashboard" || org.routeAllowed(i.to));
  }

  // Rubriques concernées par le réglage « Rubriques par poste ».
  // Les pages personnelles (fiche membre, changement de mot de passe…) ne sont jamais bloquées.
  const GUARDED_ROUTES = [
    "/taches",
    "/rapports",
    "/conges",
    "/equipes",
    "/organigramme",
    "/ressources",
    "/discussion",
    "/messagerie",
    "/reunions",
    "/idees",
    "/nouveau-projet",
    "/projets-approuves",
    "/budget-previsionnel",
    "/comptabilite",
    "/analyse",
    "/contrats",
    "/feuille-de-service",
    "/festivals",
    "/vote",
    "/casting",
    "/archives",
  ];
  const blockedByPosition =
    org.allowedRoutes.length > 0 &&
    !isGeneralProducer &&
    GUARDED_ROUTES.includes(currentBase) &&
    !org.routeAllowed(currentBase);

  // Six rubriques principales mises en avant en haut de l'écran.
  const MAIN_ROUTES = [
    "/dashboard",
    "/idees",
    "/taches",
    "/rapports",
    "/discussion",
    "/reunions",
  ];
  const mainNav = MAIN_ROUTES.map((r) => nav.find((i) => i.to === r)).filter(
    (i): i is NavItem => !!i,
  );


  const ordered =
    order.length > 0
      ? [...nav].sort((a, b) => {
          const ia = order.indexOf(a.to);
          const ib = order.indexOf(b.to);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        })
      : nav;

  function persist(list: NavItem[]) {
    const next = list.map((i) => i.to);
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
  }

  function handleDrop(target: string) {
    if (!dragged || dragged === target) return;
    const list = [...ordered];
    const from = list.findIndex((i) => i.to === dragged);
    const to = list.findIndex((i) => i.to === target);
    if (from < 0 || to < 0) return;
    const item = list[from];
    if (!item) return;
    list.splice(from, 1);
    list.splice(to, 0, item);
    persist(list);
    setDragged(null);
  }

  function rememberScroll() {
    const el = navRef.current;
    if (el) sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function switchLang(next: "fr" | "en") {
    if (next === lang) return;
    setLang(next);
    toast.success(next === "en" ? "Language switched to English." : "Langue changée en français.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="border-b border-border lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={brandLogo || logo}
            alt="Club Ciné Tremplin"
            className="h-10 w-10 rounded object-contain"
          />
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary">CLUB CINÉ TREMPLIN</p>
            <p className="text-xs text-muted-foreground">{brandSlogan}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <nav
          ref={navRef}
          className={`${menuOpen ? "flex" : "hidden"} flex-wrap gap-1 px-2 pb-3 lg:flex lg:flex-col lg:flex-nowrap lg:overflow-y-auto`}
        >
          {ordered.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              draggable
              onDragStart={() => setDragged(item.to)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(item.to)}
              onClick={() => {
                rememberScroll();
                setMenuOpen(false);
              }}
              title={`${t(item.label)} : glisser pour réordonner`}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${
                pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              } ${dragged === item.to ? "opacity-50" : ""}`}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.label)}</span>
              {badgeFor(item.to) > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {badgeFor(item.to)}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <nav className="flex flex-wrap gap-1 border-b border-border px-4 py-2 print:hidden">
            {mainNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={rememberScroll}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.label)}</span>
                {badgeFor(item.to) > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {badgeFor(item.to)}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 print:hidden">
            <div className="mr-auto min-w-0">
              <p className="text-xs text-muted-foreground">
                {me?.profile?.full_name}
                {org.myPositions.length > 0 ? ` : ${org.myPositions.join(", ")}` : ""}
                {me?.isAdmin ? " (admin)" : ""}
              </p>
              {org.myPositions.length > 1 && org.activePosition && (
                <p className="text-xs">
                  <span className="text-primary">Poste utilisé : {org.activePosition}</span>
                  {org.activePositionDescription && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {org.activePositionDescription}
                    </span>
                  )}
                </p>
              )}
            </div>
            <GlobalSearch />
            <PositionSwitcher myPositions={org.myPositions} />
            <NotificationsBell userId={me?.userId} />
            <div className="flex overflow-hidden rounded border border-border">
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchLang(l)}
                  className={`px-2 py-1 text-xs uppercase ${
                    lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? t("Mode clair") : t("Mode sombre")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {isGeneralProducer && (
              <Link to="/membres">
                <Button variant="outline" size="sm">
                  {t("Membres")}
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              {t("Déconnexion")}
            </Button>
          </div>
        </header>
        {me?.profile?.must_change_password && <PasswordGate userId={me.userId} />}
        <main key={title} className="page-enter mx-auto max-w-6xl px-4 py-6">
          <div className="film-strip mb-5 flex items-center gap-3 pb-3">
            <Button
              variant="outline"
              size="sm"
              className="print:hidden"
              onClick={() => window.history.back()}
              aria-label={t("Retour")}
              title={t("Retour")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold">{t(title)}</h1>
          </div>
          {blockedByPosition ? (
            <div className="rounded border border-border bg-secondary/40 p-6 text-sm">
              <p className="font-medium">Cette rubrique n'est pas prévue pour ce poste.</p>
              <p className="mt-1 text-muted-foreground">
                Vous utilisez le poste « {org.activePosition || org.myBasePositions[0] || "—"} ». Si
                vous occupez plusieurs postes, changez de poste en haut de l'écran. Sinon,
                demandez au Producteur général d'ouvrir cette rubrique à votre poste.
              </p>
              <Link to="/dashboard" className="mt-3 inline-block">
                <Button size="sm" variant="outline">
                  Retour au tableau de bord
                </Button>
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

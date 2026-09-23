import { PublicBrand } from "@/components/PublicBrand";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  castVote,
  voteLogin,
  voteOpen,
  voteOpenCurrent,
  voteResults,
  voteState,
  type VoteProject,
} from "@/lib/vote.functions";

export const Route = createFileRoute("/vote-acces")({
  component: VoteAccess,
  head: () => ({
    meta: [
      { title: "Vote — Club Ciné Tremplin" },
      {
        name: "description",
        content: "Espace de vote anonyme du Club Ciné Tremplin : identifiant et code de session.",
      },
      { property: "og:title", content: "Vote — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Espace de vote anonyme du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Session = {
  id: string;
  title: string;
  description: string;
  max_votes: number;
  require_distinct: boolean;
  live_results: boolean;
  closed_at: string | null;
  proclamation: string;
};

function getToken() {
  const key = "cct-vote-token";
  let t = localStorage.getItem(key);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(key, t);
  }
  return t;
}

/**
 * Un lien de vote peut arriver sous plusieurs formes selon la façon dont il a été
 * partagé (copie partielle, ajout d'espaces, lien collé dans une messagerie qui
 * remplace « ? » ou « & », lien recollé en entier dans le champ identifiant).
 * On récupère le jeton dans tous ces cas plutôt que de retomber sur le formulaire.
 */
function extractToken(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const direct = s.match(/[?&#](?:t|token)=([A-Za-z0-9-]{8,})/);
  if (direct) return direct[1] ?? null;
  const bare = s.match(/^(?:t|token)[=:]?\s*([A-Za-z0-9-]{8,})$/i);
  if (bare) return bare[1] ?? null;
  if (/^[A-Za-z0-9]{24,}$/.test(s)) return s;
  const tail = s.match(/\/vote-acces\/?([A-Za-z0-9-]{24,})$/);
  if (tail) return tail[1] ?? null;
  return null;
}

function tokenFromLocation(): string | null {
  const url = new URL(window.location.href);
  const q = url.searchParams.get("t") ?? url.searchParams.get("token");
  if (q && q.trim()) return q.trim();
  return extractToken(url.hash) ?? extractToken(window.location.href);
}

function VoteAccess() {
  const [login, setLogin] = useState("");
  const [code, setCode] = useState("");
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<VoteProject[]>([]);
  const [used, setUsed] = useState(0);
  const [voted, setVoted] = useState<string[]>([]);
  const [tally, setTally] = useState<{ code: string; votes: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  async function refreshResults(id: string) {
    const r = await voteResults({ data: { sessionId: id } });
    setTally(r.rows);
    setTotal(r.total);
  }

  useEffect(() => {
    if (!session || session.closed_at || !session.live_results) return;
    const i = setInterval(() => void refreshResults(session.id), 5000);
    return () => clearInterval(i);
  }, [session]);

  async function loadSession(s: Session, list: VoteProject[]) {
    setSession(s);
    setProjects(list);
    const st = await voteState({ data: { sessionId: s.id, token: getToken() } });
    setUsed(st.used);
    setVoted(st.votedCodes);
    void refreshResults(s.id);
  }

  // Accès direct par lien : on affiche « Ouverture du vote… », et en cas de coupure
  // réseau on réessaie deux fois avant d'afficher un message clair avec « Réessayer ».
  async function openWithToken(t: string | null) {
    setLinkError(null);
    setOpening(true);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Sans jeton dans le lien, on ouvre directement le vote en cours :
          // l'accès est libre, on ne demande ni identifiant ni code.
          const res = t ? await voteOpen({ data: { token: t } }) : await voteOpenCurrent();
          if (!res.ok) {
            setLinkError(res.error);
            return;
          }
          await loadSession(res.session as Session, res.projects);
          return;
        } catch {
          if (attempt === 2) {
            setLinkError("Connexion interrompue. Vérifiez votre réseau puis réessayez.");
            return;
          }
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        }
      }
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    const t = tokenFromLocation();
    if (t) void openWithToken(t);
  }, []);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    // Beaucoup de votants collent le lien entier dans le champ « Identifiant » :
    // on le reconnaît et on ouvre directement le vote au lieu de refuser l'accès.
    const pasted = extractToken(login) ?? extractToken(code);
    if (pasted) {
      await openWithToken(pasted);
      return;
    }
    if (!login.trim() || !code.trim()) {
      toast.error("Entrez l'identifiant et le code du vote, ou collez le lien reçu.");
      return;
    }
    setBusy(true);
    try {
      const res = await voteLogin({ data: { login: login.trim(), code: code.trim() } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await loadSession(res.session as Session, res.projects);
    } catch {
      toast.error("Connexion interrompue. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function vote(projectCode: string) {
    if (!session) return;
    setBusy(true);
    const res = await castVote({
      data: { sessionId: session.id, token: getToken(), code: projectCode },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUsed(res.used);
    setVoted(res.votedCodes);
    toast.success("Voix enregistrée");
    void refreshResults(session.id);
  }

  if (!session && opening) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <PublicBrand />
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 p-6 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm font-medium">Ouverture du vote…</p>
            <p className="text-xs text-muted-foreground">
              Merci de patienter, ne fermez pas cette page.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <PublicBrand />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base">Vote : Club Ciné Tremplin</CardTitle>
          </CardHeader>
          <CardContent>
            {linkError && (
              <div className="mb-3 space-y-2 rounded border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">{linkError}</p>
                <p className="text-xs text-muted-foreground">
                  Vous pouvez réessayer, ou entrer l'identifiant et le code communiqués par le
                  Producteur général.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const t = tokenFromLocation();
                    if (t) void openWithToken(t);
                    else setLinkError(null);
                  }}
                >
                  Réessayer
                </Button>
              </div>
            )}
            <form className="space-y-3" onSubmit={submitLogin}>
              <div className="space-y-1.5">
                <Label htmlFor="l">Identifiant du vote (ou lien reçu)</Label>
                <Input id="l" value={login} onChange={(e) => setLogin(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c">Code</Label>
                <Input id="c" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy || opening}>
                {busy || opening ? "Ouverture…" : "Accéder au vote"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Si vous avez reçu un lien de vote, vous pouvez aussi le coller dans le premier
                champ. Votre vote est anonyme : aucun nom n'est enregistré.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const closed = Boolean(session.closed_at);
  const remaining = Math.max(0, session.max_votes - used);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="sticky top-0 z-10 mb-4 rounded border border-border bg-background p-3">
        <h1 className="text-base font-semibold text-primary">{session.title}</h1>
        <p className="text-sm">
          {closed ? "Vote clos" : `Voix restantes : ${remaining} / ${session.max_votes}`}
        </p>
      </div>

      {!closed && (
        <div className="space-y-3">
          {projects.map((p) => {
            const mine = voted.includes(p.code);
            return (
              <Card key={p.code}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-mono text-lg font-semibold text-primary">{p.code}</p>
                  {p.title && <p className="text-sm font-medium">{p.title}</p>}
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <Button
                    className="w-full"
                    variant={mine ? "secondary" : "default"}
                    disabled={busy || mine || remaining === 0}
                    onClick={() => void vote(p.code)}
                  >
                    {mine ? "Voix utilisée" : remaining === 0 ? "Plus de voix" : "Voter"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun projet soumis au vote.</p>
          )}
        </div>
      )}

      {!closed && remaining === 0 && (
        <Card className="mt-4">
          <CardContent className="space-y-3 p-4 text-sm">
            <p className="font-medium">Merci pour votre participation.</p>
            <p className="text-muted-foreground">
              Vos voix sont enregistrées de façon anonyme. Les résultats seront annoncés lors de la
              proclamation officielle.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSession(null);
                setProjects([]);
                window.location.href = "/";
              }}
            >
              Quitter
            </Button>
          </CardContent>
        </Card>
      )}

      {(closed || session.live_results) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">
              {closed ? "Résultats" : "Chiffres en direct"} — {total} voix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {tally.map((r, i) => (
              <div key={r.code} className="flex justify-between text-sm">
                <span>
                  {i + 1}. <span className="font-mono">{r.code}</span>
                </span>
                <span className="text-muted-foreground">{r.votes} voix</span>
              </div>
            ))}
            {tally.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune voix exprimée.</p>
            )}
            {closed && session.proclamation && (
              <p className="pt-2 text-sm">{session.proclamation}</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

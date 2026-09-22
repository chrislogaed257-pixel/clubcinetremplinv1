import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";

const MAX_AUTO_RETRIES = 3;
const DELAYS_MS = [400, 1200, 2500];

/**
 * Écran affiché quand une page n'arrive pas à se charger.
 * Les incidents passagers (session en cours de restauration, réseau coupé une
 * seconde) sont réessayés en silence : l'utilisateur ne voit qu'un chargement.
 * Le message d'erreur n'apparaît qu'après plusieurs tentatives infructueuses.
 */
export function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (attempt >= MAX_AUTO_RETRIES) return;
    timer.current = setTimeout(() => {
      setAttempt((a) => a + 1);
      void router.invalidate();
      reset();
    }, DELAYS_MS[attempt] ?? 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (attempt < MAX_AUTO_RETRIES) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette rubrique ne s'ouvre pas
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La connexion semble interrompue. Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              setAttempt(0);
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

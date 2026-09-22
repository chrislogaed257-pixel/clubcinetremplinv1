import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Écran affiché quand une page n'arrive pas à se charger.
 * Une première tentative est refaite toute seule : la plupart des incidents
 * viennent d'une connexion momentanément coupée et disparaissent aussitôt.
 */
export function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (retried) return;
    setRetried(true);
    const t = setTimeout(() => {
      router.invalidate();
      reset();
    }, 700);
    return () => clearTimeout(t);
  }, [retried, router, reset]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Nouvelle tentative en cours…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La page met un peu de temps à s'ouvrir. Si rien ne se passe, utilisez les boutons
          ci-dessous.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
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

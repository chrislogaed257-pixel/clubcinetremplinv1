import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reçu",
  "À l'étude (comité)",
  "Décision",
  "Réponse envoyée",
  "Projet en développement",
] as const;

/** Frise de statut d'un dossier, calculée sur les colonnes existantes. */
export function currentIdeaStep(status: string, responded: boolean, votes: number) {
  const decided = status === "Projet approuvé" || status === "Refusée";
  if (status === "Projet approuvé" && responded) return 4;
  if (responded) return 3;
  if (decided) return 2;
  if (votes > 0) return 1;
  return 0;
}

export function IdeaTimeline({
  status,
  responded,
  votes,
  compact = false,
}: {
  status: string;
  responded: boolean;
  votes: number;
  compact?: boolean;
}) {
  const step = currentIdeaStep(status, responded, votes);
  const steps = status === "Refusée" ? STEPS.slice(0, 4) : STEPS;
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-2 gap-y-2", compact && "text-xs")}>
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                done && "border-primary/40 bg-primary/10 text-primary",
                active && "border-primary bg-primary/15 text-primary spotlight-pulse",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : null}
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="hidden h-px w-4 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

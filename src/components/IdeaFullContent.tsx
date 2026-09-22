type IdeaLike = {
  presentation?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  treatment?: string | null;
  intention_note?: string | null;
  directing_note?: string | null;
  script_text?: string | null;
  submitter_job?: string | null;
  experience_level?: string | null;
  presentation_link?: string | null;
  logline_link?: string | null;
  synopsis_link?: string | null;
  intention_link?: string | null;
  directing_link?: string | null;
  script_link?: string | null;
};

/** Affiche l'intégralité du dossier reçu : chaque case remplie et chaque lien fourni. */
export function IdeaFullContent({ idea }: { idea: IdeaLike }) {
  const blocks: [string, string | null | undefined, string | null | undefined][] = [
    ["Présentation de l'auteur", idea.presentation, idea.presentation_link],
    ["Logline", idea.logline, idea.logline_link],
    ["Synopsis", idea.synopsis, idea.synopsis_link],
    ["Traitement", idea.treatment, null],
    ["Note d'intention", idea.intention_note, idea.intention_link],
    ["Note du réalisateur", idea.directing_note, idea.directing_link],
    ["Scénario", idea.script_text, idea.script_link],
  ];
  const filled = blocks.filter(([, text, link]) => (text ?? "").trim() || (link ?? "").trim());
  if (filled.length === 0 && !idea.submitter_job && !idea.experience_level) return null;

  return (
    <div className="space-y-2 rounded border border-border/60 bg-secondary/30 p-3 text-sm">
      {(idea.submitter_job || idea.experience_level) && (
        <p className="text-xs text-muted-foreground">
          {idea.submitter_job ? `Poste : ${idea.submitter_job}` : ""}
          {idea.submitter_job && idea.experience_level ? " · " : ""}
          {idea.experience_level ? `Expérience : ${idea.experience_level}` : ""}
        </p>
      )}
      {filled.map(([label, text, link]) => (
        <div key={label} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {(text ?? "").trim() && <p className="whitespace-pre-wrap">{text}</p>}
          {(link ?? "").trim() && (
            <a
              href={link ?? ""}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-400 underline"
            >
              Ouvrir le document
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

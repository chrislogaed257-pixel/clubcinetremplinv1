import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/** Recherche insensible aux accents et à la casse. */
function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  /** Texte affiché quand rien ne correspond. */
  emptyLabel?: string;
};

/**
 * Case de saisie assistée : dès la première lettre, la liste des noms ou des postes
 * déjà enregistrés se réduit et il suffit de cliquer pour choisir.
 * La saisie libre reste possible : rien n'est bloqué.
 */
export function PickerInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyLabel = "Aucune correspondance — vous pouvez écrire librement.",
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const list = useMemo(() => {
    const uniq = Array.from(new Set(options.map((o) => o.trim()).filter(Boolean)));
    const q = normalize(value);
    if (!q) return uniq.slice(0, 40);
    const starts = uniq.filter((o) => normalize(o).startsWith(q));
    const contains = uniq.filter((o) => !normalize(o).startsWith(q) && normalize(o).includes(q));
    return [...starts, ...contains].slice(0, 40);
  }, [options, value]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {list.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p>
          )}
          {list.map((o) => (
            <button
              key={o}
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                onChange(o);
                setOpen(false);
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Même principe, mais pour ajouter plusieurs personnes à une liste (une par ligne). */
export function PickerAdd({
  options,
  onPick,
  placeholder = "Rechercher puis cliquer pour ajouter…",
}: {
  options: string[];
  onPick: (v: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  return (
    <PickerInput
      value={q}
      onChange={(v) => {
        if (options.includes(v)) {
          onPick(v);
          setQ("");
          return;
        }
        setQ(v);
      }}
      options={options}
      placeholder={placeholder}
    />
  );
}

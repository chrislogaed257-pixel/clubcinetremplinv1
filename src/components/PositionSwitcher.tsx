import { useActivePosition, usePositions } from "@/hooks/useOrg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PositionSwitcher({ myPositions }: { myPositions: string[] }) {
  const { active, choose } = useActivePosition(myPositions);
  const { data: positions = [] } = usePositions();
  if (myPositions.length < 2) return null;

  const baseOf = (label: string) => (label.split(" — ")[0] ?? label).trim();
  const descriptionOf = (label: string) =>
    positions.find((p) => p.name === baseOf(label))?.description ?? "";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="hidden text-[11px] text-muted-foreground xl:inline">
          Je travaille maintenant comme :
        </span>
        <Select value={active} onValueChange={choose}>
          <SelectTrigger className="h-7 w-44 text-[11px]">
            <SelectValue placeholder="Choisir un poste" />
          </SelectTrigger>
          <SelectContent>
            {myPositions.map((p) => (
              <SelectItem key={p} value={p}>
                <span>{p}</span>
                {descriptionOf(p) && (
                  <span className="block max-w-72 text-[11px] text-muted-foreground">
                    {descriptionOf(p)}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {active && descriptionOf(active) && (
        <p className="hidden max-w-40 truncate text-[10px] leading-tight text-muted-foreground 2xl:block" title={descriptionOf(active)}>
          {descriptionOf(active)}
        </p>
      )}
    </div>
  );
}

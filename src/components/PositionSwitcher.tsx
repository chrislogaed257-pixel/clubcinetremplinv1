import { useActivePosition } from "@/hooks/useOrg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PositionSwitcher({ myPositions }: { myPositions: string[] }) {
  const { active, choose } = useActivePosition(myPositions);
  if (myPositions.length < 2) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Je travaille maintenant comme :
      </span>
      <Select value={active} onValueChange={choose}>
        <SelectTrigger className="h-8 w-56 text-xs">
          <SelectValue placeholder="Choisir un poste" />
        </SelectTrigger>
        <SelectContent>
          {myPositions.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

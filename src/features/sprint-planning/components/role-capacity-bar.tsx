import type { RolePlanningCapacity } from "@/domain/sprint/planning-capacity";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RoleCapacityBarProps {
  title: string;
  subtitle: string;
  capacity: RolePlanningCapacity;
  pairedLabel?: string;
  className?: string;
}

export function RoleCapacityBar({
  title,
  subtitle,
  capacity,
  pairedLabel,
  className,
}: RoleCapacityBarProps) {
  const overloaded = capacity.utilizationPercent > 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {capacity.memberCount} people
        </p>
      </div>
      <Progress
        value={Math.min(100, capacity.utilizationPercent)}
        className={overloaded ? "[&>div]:bg-destructive" : undefined}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {capacity.plannedItems} / {capacity.wipLimit} items
          {pairedLabel ? ` · ${pairedLabel}` : ""}
        </span>
        <span className={overloaded ? "text-destructive font-medium" : undefined}>
          {capacity.utilizationPercent}%
        </span>
      </div>
    </div>
  );
}

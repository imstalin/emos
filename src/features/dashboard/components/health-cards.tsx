import type { ReleaseHealth, SprintHealth } from "@/domain/types/dashboard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cnHealthDot, formatRelativeDate, getHealthClass } from "@/lib/formatters";

export function SprintHealthCard({ sprint }: { sprint: SprintHealth }) {
  const progress =
    sprint.totalPoints > 0
      ? Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
      : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{sprint.name}</h3>
          {sprint.goal ? (
            <p className="mt-1 text-sm text-muted-foreground">{sprint.goal}</p>
          ) : null}
        </div>
        <Badge variant="outline" className={getHealthClass(sprint.health)}>
          <span className={cnHealthDot(sprint.health)} />
          {sprint.health.replace("_", " ")}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {sprint.completedPoints} / {sprint.totalPoints} points
          </span>
          <span>{progress}% complete</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-semibold tabular-nums">{sprint.daysRemaining}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Days left
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-semibold tabular-nums">{sprint.velocity}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Velocity
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-xs font-medium">
            {formatRelativeDate(sprint.endDate)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sprint end
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReleaseHealthList({ releases }: { releases: ReleaseHealth[] }) {
  if (releases.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No active releases
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {releases.map((release) => (
        <li key={release.id} className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                v{release.version}
                {release.name ? ` — ${release.name}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{release.projectName}</p>
            </div>
            <Badge variant="outline" className={getHealthClass(release.health)}>
              {release.health.replace("_", " ")}
            </Badge>
          </div>
          <Progress value={release.progressPercent} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{release.openItems} open · {release.blockedItems} blocked</span>
            <span>
              {release.targetDate
                ? `Target ${formatRelativeDate(release.targetDate)}`
                : "No target date"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

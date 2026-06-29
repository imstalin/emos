import type { TeamMemberSummary } from "@/domain/types/dashboard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  cnHealthDot,
  formatRelativeDate,
  getHealthClass,
  getInitials,
} from "@/lib/formatters";

export function TeamWorkloadList({ members }: { members: TeamMemberSummary[] }) {
  if (members.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No team members configured
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {members.map((member) => {
        const utilization = Math.min(
          100,
          Math.round((member.assignedPoints / (member.capacity * 0.5)) * 100),
        );
        const overloaded = member.assignedPoints > member.capacity * 0.5;

        return (
          <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role} · {member.activeItems} active
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={getHealthClass(member.health)}>
                    <span className={cnHealthDot(member.health)} />
                  </span>
                  {overloaded ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Overloaded
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1">
                <Progress
                  value={utilization}
                  className={overloaded ? "[&>div]:bg-destructive" : undefined}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{member.assignedPoints} pts assigned</span>
                  <span>
                    Last active{" "}
                    {member.lastActivityAt
                      ? formatRelativeDate(member.lastActivityAt)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TeamCapacityBar({
  utilizationPercent,
  allocatedPoints,
  totalCapacity,
  membersOverCapacity,
}: {
  utilizationPercent: number;
  allocatedPoints: number;
  totalCapacity: number;
  membersOverCapacity: number;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            {utilizationPercent}%
          </p>
          <p className="text-sm text-muted-foreground">Sprint utilization</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {allocatedPoints} / {totalCapacity} story points
        </p>
      </div>
      <Progress
        value={utilizationPercent}
        className={
          utilizationPercent > 80 ? "[&>div]:bg-amber-500" : undefined
        }
      />
      {membersOverCapacity > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {membersOverCapacity} team member
          {membersOverCapacity > 1 ? "s" : ""} over recommended load
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Team capacity is balanced</p>
      )}
    </div>
  );
}

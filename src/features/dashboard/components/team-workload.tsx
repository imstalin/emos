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
import {
  formatTeamCapacityLabel,
  formatWorkloadLoadLabel,
} from "@/lib/workload-labels";

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
        const overloaded = member.isOverloaded;

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
                  value={member.utilizationPercent}
                  className={overloaded ? "[&>div]:bg-destructive" : undefined}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {formatWorkloadLoadLabel(
                      member.loadBasis,
                      member.assignedPoints,
                      member.activeItems,
                      member.wipLimit,
                    )}
                  </span>
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
  allocatedItems,
  totalCapacity,
  totalWipLimit,
  membersOverCapacity,
  loadBasis,
}: {
  utilizationPercent: number;
  allocatedPoints: number;
  allocatedItems: number;
  totalCapacity: number;
  totalWipLimit: number;
  membersOverCapacity: number;
  loadBasis: TeamMemberSummary["loadBasis"];
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            {utilizationPercent}%
          </p>
          <p className="text-sm text-muted-foreground">
            {loadBasis === "story_points" ? "Sprint utilization" : "Delivery load"}
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {formatTeamCapacityLabel(
            loadBasis,
            allocatedPoints,
            allocatedItems,
            totalCapacity,
            totalWipLimit,
          )}
        </p>
      </div>
      <Progress
        value={Math.min(100, utilizationPercent)}
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

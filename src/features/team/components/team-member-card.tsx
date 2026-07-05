import type { TeamMemberDetail } from "@/domain/types/team";
import { GitPullRequest, Shield } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import {
  cnHealthDot,
  formatRelativeDate,
  getHealthClass,
  getInitials,
} from "@/lib/formatters";
import { formatWorkloadLoadLabel } from "@/lib/workload-labels";

export function TeamMemberCard({ member }: { member: TeamMemberDetail }) {
  const overloaded = member.isOverloaded;

  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-base">{member.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>{member.role}</span>
              {member.gitlabHandle ? (
                <span className="text-xs">@{member.gitlabHandle}</span>
              ) : null}
            </CardDescription>
          </div>
          <span className={getHealthClass(member.health)}>
            <span className={cnHealthDot(member.health)} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{member.activeItems} active</Badge>
          {member.role === "QA" && member.qaOwnedCount > 0 ? (
            <Badge variant="secondary">{member.qaOwnedCount} to test</Badge>
          ) : null}
          {member.blockedCount > 0 ? (
            <Badge variant="destructive">{member.blockedCount} blocked</Badge>
          ) : null}
          {member.mergeRequestCount > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <GitPullRequest className="size-3" />
              {member.mergeRequestCount} MRs
            </Badge>
          ) : null}
          {member.reviewItems.length > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Shield className="size-3" />
              {member.reviewItems.length} to review
            </Badge>
          ) : null}
          {overloaded ? (
            <Badge variant="destructive">Overloaded</Badge>
          ) : null}
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
              )}{" "}
              · {member.utilizationPercent}% load
            </span>
            <span>
              {member.lastActivityAt
                ? `Active ${formatRelativeDate(member.lastActivityAt)}`
                : "No recent activity"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 space-y-4 pt-0">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Assigned work
          </p>
          <WorkItemList
            items={member.assignedItems}
            emptyMessage="No assigned items"
            compact
          />
        </div>

        {member.role === "QA" && member.qaOwnedItems.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Assigned to test (day 1)
            </p>
            <WorkItemList
              items={member.qaOwnedItems}
              emptyMessage="No QA assignments"
              compact
            />
          </div>
        ) : null}

        {member.reviewItems.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Pending reviews
            </p>
            <WorkItemList items={member.reviewItems} compact />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

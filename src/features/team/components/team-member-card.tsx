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

export function TeamMemberCard({ member }: { member: TeamMemberDetail }) {
  const overloaded = member.assignedPoints > member.capacity * 0.5;

  return (
    <Card size="sm" className="h-full">
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
            <span>{member.assignedPoints} pts · {member.utilizationPercent}% load</span>
            <span>
              {member.lastActivityAt
                ? `Active ${formatRelativeDate(member.lastActivityAt)}`
                : "No recent activity"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
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

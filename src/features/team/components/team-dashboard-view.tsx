"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamDashboardData, TeamRoleFilter } from "@/domain/types/team";
import { SprintHealthCard } from "@/features/dashboard/components/health-cards";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import { TeamCapacityBar } from "@/features/dashboard/components/team-workload";
import { TeamMemberCard } from "@/features/team/components/team-member-card";
import { formatRelativeDate } from "@/lib/formatters";

interface TeamDashboardViewProps {
  data: TeamDashboardData;
}

export function TeamDashboardView({ data }: TeamDashboardViewProps) {
  const [roleFilter, setRoleFilter] = useState<TeamRoleFilter>("ALL");

  const filteredMembers = useMemo(() => {
    if (roleFilter === "ALL") return data.members;
    return data.members.filter((member) => member.role === roleFilter);
  }, [data.members, roleFilter]);

  const activeWithWork = filteredMembers.filter((member) => member.activeItems > 0);
  const blockedTotal = filteredMembers.reduce(
    (sum, member) => sum + member.blockedCount,
    0,
  );

  return (
    <>
      <AppHeader
        title="Team Dashboard"
        description={`Per-engineer delivery view · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <Badge variant="outline" className="hidden sm:inline-flex gap-1">
            <Users className="size-3" />
            {data.members.length} members
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Team capacity</CardTitle>
              <CardDescription>
                Story point load across the active sprint roster
              </CardDescription>
            </CardHeader>
            <TeamCapacityBar
              utilizationPercent={data.teamCapacity.utilizationPercent}
              allocatedPoints={data.teamCapacity.allocatedPoints}
              totalCapacity={data.teamCapacity.totalCapacity}
              membersOverCapacity={data.teamCapacity.membersOverCapacity}
            />
          </Card>

          {data.sprint ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sprint health</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SprintHealthCard sprint={data.sprint} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active sprint</CardTitle>
                <CardDescription>No active sprint configured</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as TeamRoleFilter)}
          >
            <TabsList>
              <TabsTrigger value="ALL">
                All ({data.members.length})
              </TabsTrigger>
              <TabsTrigger value="DEVELOPER">
                Developers ({data.filters.developers})
              </TabsTrigger>
              <TabsTrigger value="QA">QA ({data.filters.qaMembers})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{activeWithWork.length} with active work</span>
            {blockedTotal > 0 ? (
              <Badge variant="destructive">{blockedTotal} blocked</Badge>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => (
            <TeamMemberCard key={member.id} member={member} />
          ))}
        </div>

        {filteredMembers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No team members match this filter.
            </CardContent>
          </Card>
        ) : null}

        {data.unassigned.count > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unassigned work</CardTitle>
              <CardDescription>
                {data.unassigned.count} open items have no assignee in EMOS.
                Link GitLab handles in team settings to improve matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <WorkItemList
                items={data.unassigned.items}
                emptyMessage="No unassigned items"
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

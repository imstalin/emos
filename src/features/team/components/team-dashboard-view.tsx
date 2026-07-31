"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RoleCapacityBar } from "@/features/sprint-planning/components/role-capacity-bar";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        title="Team Dashboard"
        description={`Dev + QA day 1 view · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/sprints" />}
          >
            Sprint planning
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-4 lg:p-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active sprint capacity</CardTitle>
              <CardDescription>
                {data.sprint?.name ?? "No active sprint"} — plan dev build and QA test load
                together on day 1
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <RoleCapacityBar
                title="Development"
                subtitle="Open stories in active sprint"
                capacity={data.dayOne.dev}
              />
              <RoleCapacityBar
                title="QA"
                subtitle="Stories with named tester"
                capacity={{
                  ...data.dayOne.qa,
                  plannedItems: data.dayOne.qaPairedInActiveSprint,
                  utilizationPercent:
                    data.dayOne.qa.wipLimit > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (data.dayOne.qaPairedInActiveSprint / data.dayOne.qa.wipLimit) *
                              100,
                          ),
                        )
                      : 0,
                }}
                pairedLabel={`${data.dayOne.qaUnassignedInActiveSprint} need QA`}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {data.sprint ? (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sprint health</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <SprintHealthCard sprint={data.sprint} />
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Active sprint</CardTitle>
                  <CardDescription>No synced sprint — open Sprint Planning</CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">QA handoff queue</CardTitle>
                <CardDescription>In review, waiting for QA in active sprint</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemList
                  items={data.qaQueue}
                  compact
                  emptyMessage="Nothing awaiting QA"
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as TeamRoleFilter)}
            >
              <TabsList>
                <TabsTrigger value="ALL">All ({data.members.length})</TabsTrigger>
                <TabsTrigger value="DEVELOPER">
                  Developers ({data.filters.developers})
                </TabsTrigger>
                <TabsTrigger value="QA">QA ({data.filters.qaMembers})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Users className="size-3" />
                {activeWithWork.length} with active work
              </Badge>
              {blockedTotal > 0 ? (
                <Badge variant="destructive">{blockedTotal} blocked</Badge>
              ) : null}
              {!data.dayOne.sprintBalanced ? (
                <Badge variant="destructive">Sprint over capacity</Badge>
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

          {data.sprintWorkItems.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active sprint roster</CardTitle>
                <CardDescription>
                  {data.sprintWorkItems.length} open items with dev and QA owners
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <WorkItemList items={data.sprintWorkItems} />
              </CardContent>
            </Card>
          ) : null}

          {data.unassigned.count > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unassigned dev work</CardTitle>
                <CardDescription>
                  {data.unassigned.count} open items have no developer assignee in EMOS
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
      </div>
    </div>
  );
}

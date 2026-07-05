"use client";

import Link from "next/link";
import type { DashboardMetrics } from "@/domain/types/dashboard";
import {
  AlertTriangle,
  Bug,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Flame,
  GitPullRequest,
  Target,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetricCard,
  SectionCard,
} from "@/features/dashboard/components/metric-card";
import {
  ReleaseHealthList,
  SprintHealthCard,
} from "@/features/dashboard/components/health-cards";
import { TeamWorkloadList } from "@/features/dashboard/components/team-workload";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import { RoleCapacityBar } from "@/features/sprint-planning/components/role-capacity-bar";
import { formatRelativeDate } from "@/lib/formatters";

interface DashboardViewProps {
  metrics: DashboardMetrics;
}

export function DashboardView({ metrics }: DashboardViewProps) {
  const { teamStatus, qaStatus, dayOne, sprintHealth } = metrics;

  return (
    <>
      <AppHeader
        title="Dashboard"
        description={`Active sprint delivery · Updated ${formatRelativeDate(metrics.generatedAt)}`}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/sprints" />}>
            Sprint planning
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active Sprint"
            value={sprintHealth?.name ?? "None"}
            description={
              sprintHealth
                ? `${sprintHealth.totalItems} items · ${sprintHealth.daysRemaining}d left`
                : "No synced sprint"
            }
            icon={CalendarRange}
            health={sprintHealth?.health}
          />
          <MetricCard
            title="Day 1 balance"
            value={dayOne.sprintBalanced ? "Ready" : "Attention"}
            description={`${dayOne.qaPairedInActiveSprint} QA paired · ${dayOne.qaUnassignedInActiveSprint} unassigned`}
            icon={Users}
            health={dayOne.sprintBalanced ? "HEALTHY" : "AT_RISK"}
          />
          <MetricCard
            title="Awaiting QA"
            value={qaStatus.awaitingQa}
            description={`${qaStatus.inQa} currently in QA`}
            icon={ClipboardCheck}
            health={qaStatus.awaitingQa > dayOne.qa.wipLimit ? "AT_RISK" : "HEALTHY"}
          />
          <MetricCard
            title="Blockers"
            value={metrics.blockers.length}
            description="Items blocking delivery"
            icon={AlertTriangle}
            health={metrics.blockers.length > 0 ? "CRITICAL" : "HEALTHY"}
          />
        </section>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dev & QA capacity (active sprint)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <RoleCapacityBar
              title="Development"
              subtitle="Stories in the active sprint"
              capacity={dayOne.dev}
            />
            <RoleCapacityBar
              title="QA"
              subtitle="Stories with a named tester"
              capacity={{
                ...dayOne.qa,
                plannedItems: dayOne.qaPairedInActiveSprint,
                utilizationPercent:
                  dayOne.qa.wipLimit > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (dayOne.qaPairedInActiveSprint / dayOne.qa.wipLimit) * 100,
                        ),
                      )
                    : 0,
              }}
              pairedLabel={`${dayOne.qaUnassignedInActiveSprint} need QA`}
            />
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Sprint Health"
            description="Progress on the synced active sprint"
            badge={
              sprintHealth ? (
                <Badge variant={sprintHealth.sprintBalanced ? "secondary" : "destructive"}>
                  {sprintHealth.sprintBalanced ? "Balanced" : "Over capacity"}
                </Badge>
              ) : null
            }
          >
            {sprintHealth ? (
              <SprintHealthCard sprint={sprintHealth} />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active sprint — sync milestones in Sprint Planning
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Active Sprint Work"
            description="Dev + QA ownership for day 1"
            badge={
              <Badge variant="secondary">{metrics.sprintWorkItems.length} open</Badge>
            }
          >
            <WorkItemList
              items={metrics.sprintWorkItems.slice(0, 12)}
              compact
              emptyMessage="No items in the active sprint"
            />
          </SectionCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Release Health"
            description="Upcoming releases"
            badge={
              <Badge variant="secondary">{metrics.releaseHealth.length} active</Badge>
            }
          >
            <ReleaseHealthList releases={metrics.releaseHealth} />
          </SectionCard>

          <SectionCard
            title="QA Pipeline"
            description="Review handoff and testing in active sprint"
          >
            <div className="grid grid-cols-3 gap-px bg-border">
              {[
                { label: "In QA", value: qaStatus.inQa },
                { label: "Awaiting", value: qaStatus.awaitingQa },
                { label: "Failed", value: qaStatus.failedQa },
              ].map((stat) => (
                <div key={stat.label} className="bg-card p-4 text-center">
                  <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <WorkItemList items={qaStatus.items} compact emptyMessage="No QA items" />
          </SectionCard>
        </section>

        <section>
          <Tabs defaultValue="sprint">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Work queues</h2>
                <p className="text-sm text-muted-foreground">
                  Sprint scope first, then broader delivery
                </p>
              </div>
              <TabsList>
                <TabsTrigger value="sprint">
                  Sprint ({metrics.sprintWorkItems.length})
                </TabsTrigger>
                <TabsTrigger value="priority">
                  <Flame className="size-3.5" />
                  Priority ({metrics.highPriority.length})
                </TabsTrigger>
                <TabsTrigger value="reviews">
                  Reviews ({metrics.pendingReviews.length})
                </TabsTrigger>
                <TabsTrigger value="blockers">
                  Blockers ({metrics.blockers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="sprint">
              <SectionCard title="Sprint queue" description="Items in the active sprint milestone">
                <WorkItemList items={metrics.sprintWorkItems} />
              </SectionCard>
            </TabsContent>
            <TabsContent value="priority">
              <SectionCard title="High priority" description="Critical and high items">
                <WorkItemList items={metrics.highPriority} />
              </SectionCard>
            </TabsContent>
            <TabsContent value="reviews">
              <SectionCard title="Pending reviews" description="Ready for code review">
                <WorkItemList items={metrics.pendingReviews} />
              </SectionCard>
            </TabsContent>
            <TabsContent value="blockers">
              <SectionCard title="Blockers" description="Needs manager attention">
                <WorkItemList
                  items={metrics.blockers}
                  emptyMessage="No blockers — great job!"
                />
              </SectionCard>
            </TabsContent>
          </Tabs>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Product Backlog Tasks"
            description="Milestone Backlog · not defects"
            badge={
              <Badge variant="secondary">
                <ClipboardList className="size-3" />
                {metrics.productBacklog.tasks.length}
              </Badge>
            }
          >
            <WorkItemList
              items={metrics.productBacklog.tasks.slice(0, 8)}
              compact
              emptyMessage="No backlog tasks"
            />
          </SectionCard>

          <SectionCard
            title="Team workload"
            description={`${teamStatus.developers} dev · ${teamStatus.qaMembers} QA`}
            badge={
              <Badge variant="outline">
                <Target className="size-3" />
                {metrics.teamCapacity.utilizationPercent}%
              </Badge>
            }
          >
            <TeamWorkloadList members={metrics.workload} />
          </SectionCard>
        </section>
      </div>
    </>
  );
}

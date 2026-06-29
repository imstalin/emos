import type { DashboardMetrics } from "@/domain/types/dashboard";
import Link from "next/link";
import {
  AlertTriangle,
  Bug,
  ClipboardCheck,
  ClipboardList,
  Flame,
  GitPullRequest,
  Target,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetricCard,
  SectionCard,
} from "@/features/dashboard/components/metric-card";
import {
  ReleaseHealthList,
  SprintHealthCard,
} from "@/features/dashboard/components/health-cards";
import {
  TeamCapacityBar,
  TeamWorkloadList,
} from "@/features/dashboard/components/team-workload";
import { WorkItemList } from "@/features/dashboard/components/work-item-list";
import { formatRelativeDate } from "@/lib/formatters";

interface DashboardViewProps {
  metrics: DashboardMetrics;
}

export function DashboardView({ metrics }: DashboardViewProps) {
  const { teamStatus, teamCapacity, qaStatus } = metrics;

  return (
    <>
      <AppHeader
        title="Dashboard"
        description={`Delivery overview · Updated ${formatRelativeDate(metrics.generatedAt)}`}
        actions={
          <Badge variant="outline" className="hidden sm:inline-flex">
            {teamStatus.overallHealth.replace("_", " ")}
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* Top metrics row */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Team Status"
            value={`${teamStatus.activeMembers}/${teamStatus.totalMembers}`}
            description={`${teamStatus.developers} dev · ${teamStatus.qaMembers} QA`}
            icon={Users}
            health={teamStatus.overallHealth}
          />
          <MetricCard
            title="Blockers"
            value={metrics.blockers.length}
            description="Items blocking delivery"
            icon={AlertTriangle}
            health={metrics.blockers.length > 0 ? "CRITICAL" : "HEALTHY"}
          />
          <MetricCard
            title="Pending Reviews"
            value={metrics.pendingReviews.length}
            description="MRs awaiting code review"
            icon={GitPullRequest}
            health={
              metrics.pendingReviews.length > 3 ? "AT_RISK" : "HEALTHY"
            }
          />
          <MetricCard
            title="Production Issues"
            value={metrics.productionIssues.length}
            description="Active production incidents"
            icon={Bug}
            health={
              metrics.productionIssues.length > 0 ? "CRITICAL" : "HEALTHY"
            }
          />
        </section>

        {/* Sprint & Release health */}
        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Sprint Health"
            description="Active sprint progress and velocity"
            badge={
              metrics.sprintHealth ? (
                <Badge variant="secondary">
                  {metrics.sprintHealth.daysRemaining}d remaining
                </Badge>
              ) : null
            }
          >
            {metrics.sprintHealth ? (
              <SprintHealthCard sprint={metrics.sprintHealth} />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active sprint configured
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Release Health"
            description="Upcoming releases and delivery risk"
            badge={
              <Badge variant="secondary">
                {metrics.releaseHealth.length} active
              </Badge>
            }
          >
            <ReleaseHealthList releases={metrics.releaseHealth} />
          </SectionCard>
        </section>

        {/* Product backlog (milestone Backlog + Type label) */}
        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Product Backlog Tasks"
            description="Milestone Backlog · Type is not Defect"
            badge={
              <Badge variant="secondary">
                <ClipboardList className="size-3" />
                {metrics.productBacklog.tasks.length}
              </Badge>
            }
          >
            <WorkItemList
              items={metrics.productBacklog.tasks.slice(0, 8)}
              emptyMessage="No backlog tasks in the Backlog milestone"
            />
            {metrics.productBacklog.tasks.length > 0 ? (
              <div className="border-t px-4 py-3">
                <Link
                  href="/product-backlog?tab=tasks"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  View all tasks →
                </Link>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Product Backlog Defects"
            description="Milestone Backlog · Type::Defect"
            badge={
              <Badge variant="secondary">
                <Bug className="size-3" />
                {metrics.productBacklog.defects.length}
              </Badge>
            }
          >
            <WorkItemList
              items={metrics.productBacklog.defects.slice(0, 8)}
              emptyMessage="No backlog defects in the Backlog milestone"
            />
            {metrics.productBacklog.defects.length > 0 ? (
              <div className="border-t px-4 py-3">
                <Link
                  href="/product-backlog?tab=defects"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  View all defects →
                </Link>
              </div>
            ) : null}
          </SectionCard>
        </section>

        {/* Work queues */}
        <section>
          <Tabs defaultValue="current">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Work Queues</h2>
                <p className="text-sm text-muted-foreground">
                  Current work, priorities, and blockers
                </p>
              </div>
              <TabsList>
                <TabsTrigger value="current">
                  Current ({metrics.currentWork.length})
                </TabsTrigger>
                <TabsTrigger value="priority">
                  <Flame className="size-3.5" />
                  Priority ({metrics.highPriority.length})
                </TabsTrigger>
                <TabsTrigger value="blockers">
                  Blockers ({metrics.blockers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="current">
              <SectionCard title="Current Work" description="In progress and open items">
                <WorkItemList items={metrics.currentWork} />
              </SectionCard>
            </TabsContent>
            <TabsContent value="priority">
              <SectionCard
                title="High Priority"
                description="Critical and high priority items requiring attention"
              >
                <WorkItemList items={metrics.highPriority} />
              </SectionCard>
            </TabsContent>
            <TabsContent value="blockers">
              <SectionCard
                title="Blockers"
                description="Items blocked and needing manager intervention"
              >
                <WorkItemList
                  items={metrics.blockers}
                  emptyMessage="No blockers — great job!"
                />
              </SectionCard>
            </TabsContent>
          </Tabs>
        </section>

        {/* QA, Reviews, Capacity */}
        <section className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            title="QA Status"
            description="Testing pipeline overview"
            badge={<Badge variant="secondary">{qaStatus.inQa} in QA</Badge>}
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

          <SectionCard
            title="Pending Reviews"
            description="Merge requests awaiting review"
          >
            <WorkItemList
              items={metrics.pendingReviews}
              compact
              emptyMessage="Review queue is clear"
            />
          </SectionCard>

          <SectionCard
            title="Team Capacity"
            description="Sprint load and utilization"
            badge={
              <Badge variant="outline">
                <Target className="size-3" />
                {teamCapacity.utilizationPercent}%
              </Badge>
            }
          >
            <TeamCapacityBar
              utilizationPercent={teamCapacity.utilizationPercent}
              allocatedPoints={teamCapacity.allocatedPoints}
              totalCapacity={teamCapacity.totalCapacity}
              membersOverCapacity={teamCapacity.membersOverCapacity}
            />
          </SectionCard>
        </section>

        {/* Team workload */}
        <SectionCard
          title="Team Workload"
          description="Per-engineer capacity, assignments, and health"
          badge={
            <Badge variant="secondary">
              <ClipboardCheck className="size-3" />
              {metrics.workload.length} members
            </Badge>
          }
        >
          <TeamWorkloadList members={metrics.workload} />
        </SectionCard>
      </div>
    </>
  );
}

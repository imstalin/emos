"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock,
  ExternalLink,
  Shield,
  UserX,
} from "lucide-react";

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
import type {
  FollowUpCategoryFilter,
  FollowUpItem,
  FollowUpsDashboard,
} from "@/domain/types/follow-ups";
import { formatRelativeDate, getPriorityVariant } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<FollowUpItem["category"], string> = {
  blocked: "Blocked",
  overdue: "Overdue",
  stale_review: "Stale review",
  stale_activity: "Inactive",
  critical: "Critical",
  unassigned: "Unassigned",
  governance: "Governance",
  workload: "Workload",
};

interface FollowUpsViewProps {
  data: FollowUpsDashboard;
}

export function FollowUpsView({ data }: FollowUpsViewProps) {
  const [categoryFilter, setCategoryFilter] =
    useState<FollowUpCategoryFilter>("ALL");

  const filteredItems = useMemo(() => {
    if (categoryFilter === "ALL") return data.items;
    return data.items.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, data.items]);

  return (
    <>
      <AppHeader
        title="Follow-ups"
        description={`Manager action queue · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <Badge variant="outline" className="gap-1">
            <Bell className="size-3" />
            {data.total} actions
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Critical"
            value={data.byPriority.critical}
            highlight={data.byPriority.critical > 0}
          />
          <StatCard label="High" value={data.byPriority.high} />
          <StatCard label="Blocked" value={data.byCategory.blocked} />
          <StatCard label="Overdue" value={data.byCategory.overdue} />
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Action queue</CardTitle>
              <CardDescription>
                Derived from blockers, overdue items, stale reviews, governance
                violations, and team workload
              </CardDescription>
            </div>

            <Tabs
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(value as FollowUpCategoryFilter)
              }
            >
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="ALL">All ({data.total})</TabsTrigger>
                <TabsTrigger value="blocked">
                  Blocked ({data.byCategory.blocked})
                </TabsTrigger>
                <TabsTrigger value="overdue">
                  Overdue ({data.byCategory.overdue})
                </TabsTrigger>
                <TabsTrigger value="stale_review">
                  Reviews ({data.byCategory.stale_review})
                </TabsTrigger>
                <TabsTrigger value="governance">
                  Governance ({data.byCategory.governance})
                </TabsTrigger>
                <TabsTrigger value="workload">
                  Workload ({data.byCategory.workload})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="p-0">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                <Bell className="size-4" />
                No follow-ups for this filter.
              </div>
            ) : (
              <ul className="divide-y">
                {filteredItems.map((item) => (
                  <FollowUpRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <CategoryIcon category={item.category} />
            {item.webUrl ? (
              <a
                href={item.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-medium hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <p className="truncate text-sm font-medium">{item.title}</p>
            )}
            {item.webUrl ? (
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[item.category]}
            {item.projectName ? ` · ${item.projectName}` : ""}
            {item.assigneeName ? ` · ${item.assigneeName}` : ""}
          </p>
        </div>
        <Badge variant={getPriorityVariant(item.priority)} className="shrink-0">
          {item.priority}
        </Badge>
      </div>

      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
        <p className="text-muted-foreground">{item.reason}</p>
        <p className="mt-2 font-medium">{item.suggestedAction}</p>
      </div>

      {(item.dueDate || item.lastActivityAt) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {item.dueDate ? <span>Due {formatRelativeDate(item.dueDate)}</span> : null}
          {item.lastActivityAt ? (
            <span>Last activity {formatRelativeDate(item.lastActivityAt)}</span>
          ) : null}
        </div>
      )}
    </li>
  );
}

function CategoryIcon({ category }: { category: FollowUpItem["category"] }) {
  const className = "size-4 shrink-0 text-muted-foreground";

  switch (category) {
    case "blocked":
      return <AlertTriangle className={cn(className, "text-red-500")} />;
    case "overdue":
      return <Clock className={cn(className, "text-amber-500")} />;
    case "governance":
      return <Shield className={className} />;
    case "unassigned":
      return <UserX className={className} />;
    default:
      return <Bell className={className} />;
  }
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            highlight
              ? "text-2xl font-semibold text-red-600 dark:text-red-400"
              : "text-2xl font-semibold"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

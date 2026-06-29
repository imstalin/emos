"use client";

import { useMemo, useState } from "react";
import {
  Bug,
  ClipboardList,
  Search,
  UserX,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ProductBacklogData,
  ProductBacklogItem,
  ProductBacklogTab,
} from "@/domain/types/product-backlog";
import { ProductBacklogTable } from "@/features/product-backlog/components/product-backlog-table";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { formatRelativeDate } from "@/lib/formatters";

interface ProductBacklogViewProps {
  data: ProductBacklogData;
  initialTab?: ProductBacklogTab;
}

function filterItems(
  items: ProductBacklogItem[],
  search: string,
  priority: string,
  project: string,
): ProductBacklogItem[] {
  return items.filter((item) => {
    if (priority !== "ALL" && item.priority !== priority) return false;
    if (project !== "ALL" && item.projectName !== project) return false;
    if (!search.trim()) return true;

    const query = search.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.labels.some((label) => label.toLowerCase().includes(query)) ||
      item.assigneeName?.toLowerCase().includes(query)
    );
  });
}

export function ProductBacklogView({
  data,
  initialTab = "tasks",
}: ProductBacklogViewProps) {
  const [tab, setTab] = useState<ProductBacklogTab>(initialTab);
  const [searchInput, setSearchInput] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");

  const projects = useMemo(
    () => data.summary.byProject.map((row) => row.projectName),
    [data.summary.byProject],
  );

  const filteredTasks = useMemo(
    () =>
      filterItems(data.tasks, searchInput, priorityFilter, projectFilter),
    [data.tasks, searchInput, priorityFilter, projectFilter],
  );
  const filteredDefects = useMemo(
    () =>
      filterItems(data.defects, searchInput, priorityFilter, projectFilter),
    [data.defects, searchInput, priorityFilter, projectFilter],
  );

  const activeItems = tab === "tasks" ? filteredTasks : filteredDefects;

  return (
    <>
      <AppHeader
        title="Product Backlog"
        description={`Milestone Backlog · Updated ${formatRelativeDate(data.generatedAt)}`}
        actions={
          <Badge variant="outline" className="gap-1">
            <ClipboardList className="size-3" />
            {data.summary.total} items
          </Badge>
        }
      />

      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Backlog tasks"
            value={data.summary.tasks}
            description="Milestone Backlog · not Defect"
            icon={ClipboardList}
          />
          <MetricCard
            title="Backlog defects"
            value={data.summary.defects}
            description="Milestone Backlog · Type::Defect"
            icon={Bug}
          />
          <MetricCard
            title="Critical / High"
            value={`${data.summary.critical} / ${data.summary.high}`}
            description="Priority items in backlog"
            icon={Bug}
            health={
              data.summary.critical > 0 ? "CRITICAL" : data.summary.high > 0 ? "AT_RISK" : "HEALTHY"
            }
          />
          <MetricCard
            title="Unassigned"
            value={data.summary.unassigned}
            description="No assignee on backlog items"
            icon={UserX}
          />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search title, labels, assignee…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  label="Priority"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"]}
                />
                <FilterSelect
                  label="Project"
                  value={projectFilter}
                  onChange={setProjectFilter}
                  options={["ALL", ...projects]}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Tasks</strong> —
              milestone <code className="text-xs">Backlog</code> and{" "}
              <code className="text-xs">Type::*</code> is not Defect.{" "}
              <strong className="font-medium text-foreground">Defects</strong> —
              milestone Backlog and <code className="text-xs">Type::Defect</code>.
            </p>
          </CardContent>
        </Card>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ProductBacklogTab)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="tasks" className="gap-1.5">
                <ClipboardList className="size-3.5" />
                Tasks ({filteredTasks.length})
              </TabsTrigger>
              <TabsTrigger value="defects" className="gap-1.5">
                <Bug className="size-3.5" />
                Defects ({filteredDefects.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="mt-4">
            <ProductBacklogTable
              items={filteredTasks}
              emptyMessage="No product backlog tasks match your filters"
            />
          </TabsContent>
          <TabsContent value="defects" className="mt-4">
            <ProductBacklogTable
              items={filteredDefects}
              emptyMessage="No product backlog defects match your filters"
            />
          </TabsContent>
        </Tabs>

        {activeItems.length === 0 && data.summary.total > 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Try clearing filters or switching tabs.
          </p>
        ) : null}
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "ALL" ? "All" : option}
          </option>
        ))}
      </select>
    </label>
  );
}

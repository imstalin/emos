"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  KanbanSquare,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  SprintAssignmentResult,
  SprintPlanningBoard,
  SprintQaOwnerResult,
} from "@/domain/types/sprint-planning";
import { RoleCapacityBar } from "@/features/sprint-planning/components/role-capacity-bar";
import {
  SprintPlanningItemRow,
  type SprintMoveOption,
} from "@/features/sprint-planning/components/sprint-planning-item-row";
import { formatRelativeDate } from "@/lib/formatters";

interface SprintPlanningViewProps {
  initialBoard: SprintPlanningBoard;
}

async function fetchBoard(): Promise<SprintPlanningBoard> {
  const response = await fetch("/api/sprints/planning");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load sprint planning board");
  }
  return response.json();
}

async function postPlanningAction(
  body: Record<string, unknown>,
): Promise<SprintAssignmentResult | SprintQaOwnerResult> {
  const response = await fetch("/api/sprints/planning/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Action failed");
  }
  return payload;
}

function formatSprintDates(startDate: string, endDate: string): string {
  const start = new Date(startDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const end = new Date(endDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

export function SprintPlanningView({ initialBoard }: SprintPlanningViewProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [bulkQaOwnerId, setBulkQaOwnerId] = useState("");
  const [targetSprintId, setTargetSprintId] = useState(
    initialBoard.sprints.find((sprint) => sprint.isActive)?.id ??
      initialBoard.sprints[0]?.id ??
      "",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const boardQuery = useQuery({
    queryKey: ["sprint-planning"],
    queryFn: fetchBoard,
    initialData: initialBoard,
  });

  const board = boardQuery.data;
  const activeSprint = board.sprints.find((sprint) => sprint.isActive);
  const { dayOne } = board;

  const filteredBacklog = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return board.backlog;
    return board.backlog.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.assigneeName?.toLowerCase().includes(query) ||
        item.qaOwnerName?.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query),
    );
  }, [board.backlog, search]);

  const mutation = useMutation({
    mutationFn: postPlanningAction,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["sprint-planning"] });
      if ("assigned" in result) {
        setSelectedIds(new Set());
        setStatusMessage(
          `Moved ${result.assigned} item(s) to ${result.sprintName ?? "Sprint Backlog"}. GitLab updated: ${result.gitlabUpdated}.`,
        );
      } else if ("updated" in result) {
        setStatusMessage(
          `Updated QA owner on ${result.updated} item(s)${result.qaOwnerName ? ` → ${result.qaOwnerName}` : ""}.`,
        );
      }
    },
    onError: (error: Error) => {
      setStatusMessage(error.message);
    },
  });

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleQaOwnerChange(workItemId: string, qaOwnerId: string | null) {
    mutation.mutate({
      action: "set_qa_owner",
      workItemIds: [workItemId],
      qaOwnerId,
    });
  }

  function handleMoveToSprint(workItemId: string, sprintId: string) {
    mutation.mutate({
      action: "assign",
      sprintId,
      workItemIds: [workItemId],
      syncGitLab: true,
    });
  }

  function handleMoveToBacklog(workItemId: string) {
    mutation.mutate({
      action: "backlog",
      workItemIds: [workItemId],
      syncGitLab: true,
    });
  }

  const sprintMoveOptions: SprintMoveOption[] = board.sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    isActive: sprint.isActive,
  }));

  const selectedCount = selectedIds.size;
  const bottleneckMessage =
    dayOne.bottleneck === "qa"
      ? "QA capacity is the bottleneck — trim sprint scope or pair more stories with QA on day 1."
      : dayOne.bottleneck === "dev"
        ? "Dev capacity is the bottleneck — fewer stories than QA can test."
        : "Dev and QA load look balanced for this sprint size.";

  return (
    <>
      <AppHeader
        title="Sprint Planning"
        description="Day 1 planning: agree what dev builds and who from QA tests each story — before the sprint starts."
      />

      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Day 1 capacity check</CardTitle>
              {activeSprint ? (
                <Badge variant="outline">
                  {activeSprint.name} · {formatSprintDates(activeSprint.startDate, activeSprint.endDate)}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Recommended sprint size: <strong>{board.recommendedSprintItems} items</strong>{" "}
              (limited by both dev build and QA test capacity).
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <RoleCapacityBar
              title="Development"
              subtitle="Stories committed for engineers to build"
              capacity={dayOne.dev}
            />
            <RoleCapacityBar
              title="QA"
              subtitle="Stories with a named tester from day 1"
              capacity={{
                ...dayOne.qa,
                plannedItems: dayOne.qaPairedInActiveSprint,
                utilizationPercent: dayOne.qa.wipLimit
                  ? Math.min(
                      100,
                      Math.round(
                        (dayOne.qaPairedInActiveSprint / dayOne.qa.wipLimit) * 100,
                      ),
                    )
                  : 0,
              }}
              pairedLabel={`${dayOne.qaUnassignedInActiveSprint} still need QA`}
            />
          </CardContent>
          <CardContent className="border-t pt-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {dayOne.sprintBalanced ? (
                <Badge className="gap-1">
                  <Users className="size-3" />
                  Ready for day 1
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Needs planning attention
                </Badge>
              )}
              <span className="text-muted-foreground">{bottleneckMessage}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void boardQuery.refetch()}
            disabled={boardQuery.isFetching}
          >
            {boardQuery.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                action: "plan_active",
                syncGitLab: true,
                maxItems: board.recommendedSprintItems,
              })
            }
          >
            <Sparkles className="size-4" />
            Auto-plan dev scope
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={mutation.isPending || board.qaMembers.length === 0}
            onClick={() => mutation.mutate({ action: "auto_assign_qa" })}
          >
            <Users className="size-4" />
            Distribute QA owners
          </Button>
          {statusMessage ? (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <Card className="flex min-h-0 flex-col py-0">
            <CardHeader className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Planning backlog</CardTitle>
                <Badge variant="secondary">{filteredBacklog.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Updated {formatRelativeDate(board.generatedAt)}
              </p>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <Input
                placeholder="Search backlog…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedIds(new Set(filteredBacklog.map((i) => i.id)))}
                >
                  Select visible
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setSelectedIds(new Set())}>
                  Clear ({selectedCount})
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={targetSprintId}
                  onChange={(event) => setTargetSprintId(event.target.value)}
                  className="h-8 min-w-40 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {board.sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.isActive ? "Active · " : ""}
                      {sprint.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={selectedCount === 0 || mutation.isPending || !targetSprintId}
                  onClick={() =>
                    mutation.mutate({
                      action: "assign",
                      sprintId: targetSprintId,
                      workItemIds: [...selectedIds],
                      syncGitLab: true,
                    })
                  }
                >
                  Move to sprint
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedCount === 0 || mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      action: "backlog",
                      workItemIds: [...selectedIds],
                      syncGitLab: true,
                    })
                  }
                >
                  Move to backlog
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkQaOwnerId}
                  onChange={(event) => setBulkQaOwnerId(event.target.value)}
                  className="h-8 min-w-36 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">Bulk QA owner</option>
                  {board.qaMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedCount === 0 || !bulkQaOwnerId || mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      action: "set_qa_owner",
                      workItemIds: [...selectedIds],
                      qaOwnerId: bulkQaOwnerId,
                    })
                  }
                >
                  Set QA on selected
                </Button>
              </div>
              <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
                {filteredBacklog.length === 0 ? (
                  <li className="p-8 text-center text-sm text-muted-foreground">
                    No backlog items ready for sprint planning.
                  </li>
                ) : (
                  filteredBacklog.map((item) => (
                    <SprintPlanningItemRow
                      key={item.id}
                      item={item}
                      qaMembers={board.qaMembers}
                      selectable
                      showQaOwner
                      qaUpdating={mutation.isPending}
                      selected={selectedIds.has(item.id)}
                      onToggle={toggleSelection}
                      onQaOwnerChange={handleQaOwnerChange}
                      currentSprintId={null}
                      sprintMoveOptions={sprintMoveOptions}
                      onMoveToSprint={handleMoveToSprint}
                      moveUpdating={mutation.isPending}
                    />
                  ))
                )}
              </ul>
            </CardContent>
          </Card>

          <div className="grid min-h-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {board.sprints.map((sprint) => (
              <Card key={sprint.id} className="flex min-h-0 flex-col py-0">
                <CardHeader className="border-b px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{sprint.name}</CardTitle>
                    {sprint.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Upcoming</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatSprintDates(sprint.startDate, sprint.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sprint.itemCount} dev items · QA paired {sprint.qaPairedCount}
                    {sprint.qaUnassignedCount > 0
                      ? ` · ${sprint.qaUnassignedCount} need tester`
                      : ""}
                  </p>
                  {sprint.items.some((item) => selectedIds.has(item.id)) ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={mutation.isPending || !targetSprintId}
                        onClick={() =>
                          mutation.mutate({
                            action: "assign",
                            sprintId: targetSprintId,
                            workItemIds: sprint.items
                              .filter((item) => selectedIds.has(item.id))
                              .map((item) => item.id),
                            syncGitLab: true,
                          })
                        }
                      >
                        Move selected
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            action: "backlog",
                            workItemIds: sprint.items
                              .filter((item) => selectedIds.has(item.id))
                              .map((item) => item.id),
                            syncGitLab: true,
                          })
                        }
                      >
                        To backlog
                      </Button>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="min-h-0 flex-1 p-0">
                  <ul className="max-h-[32rem] divide-y overflow-y-auto">
                    {sprint.items.length === 0 ? (
                      <li className="p-8 text-center text-sm text-muted-foreground">
                        No issues planned yet.
                      </li>
                    ) : (
                      sprint.items.map((item) => (
                        <SprintPlanningItemRow
                          key={item.id}
                          item={item}
                          qaMembers={board.qaMembers}
                          selectable
                          showQaOwner={sprint.isActive}
                          qaUpdating={mutation.isPending}
                          selected={selectedIds.has(item.id)}
                          onToggle={toggleSelection}
                          onQaOwnerChange={handleQaOwnerChange}
                          currentSprintId={sprint.id}
                          sprintMoveOptions={sprintMoveOptions}
                          onMoveToSprint={handleMoveToSprint}
                          onMoveToBacklog={handleMoveToBacklog}
                          moveUpdating={mutation.isPending}
                        />
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

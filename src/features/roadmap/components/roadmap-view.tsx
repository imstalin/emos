"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconPlus, IconRefresh } from "@tabler/icons-react";

import { AppHeader } from "@/components/layout/app-header";
import {
  DEFAULT_ROADMAP_FILTERS,
  DEFAULT_ROADMAP_SORT,
  type RoadmapData,
  type RoadmapItem,
} from "@/domain/types/roadmap";
import { RoadmapFilters } from "@/features/roadmap/components/roadmap-filters";
import { RoadmapForm } from "@/features/roadmap/components/roadmap-form";
import { RoadmapMantineProvider } from "@/features/roadmap/components/roadmap-mantine-provider";
import { RoadmapSummaryCards } from "@/features/roadmap/components/roadmap-summary-cards";
import { RoadmapTable } from "@/features/roadmap/components/roadmap-table";
import {
  buildRoadmapSummary,
  collectFilterOptions,
  filterRoadmapItems,
  sortRoadmapItems,
} from "@/features/roadmap/lib/roadmap-utils";
import { formatRelativeDate } from "@/lib/formatters";

interface RoadmapViewProps {
  initialData: RoadmapData;
}

export function RoadmapView({ initialData }: RoadmapViewProps) {
  return (
    <RoadmapMantineProvider>
      <RoadmapViewContent initialData={initialData} />
    </RoadmapMantineProvider>
  );
}

function RoadmapViewContent({ initialData }: RoadmapViewProps) {
  const [items, setItems] = useState(initialData.items);
  const [generatedAt, setGeneratedAt] = useState(initialData.generatedAt);
  const [sourceSheet] = useState(initialData.sourceSheet);
  const [filters, setFilters] = useState(DEFAULT_ROADMAP_FILTERS);
  const [sort, setSort] = useState(DEFAULT_ROADMAP_SORT);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filterOptions = useMemo(() => collectFilterOptions(items), [items]);

  const filteredItems = useMemo(() => {
    const filtered = filterRoadmapItems(items, filters);
    return sortRoadmapItems(filtered, sort);
  }, [items, filters, sort]);

  const summary = useMemo(() => buildRoadmapSummary(items), [items]);

  const applyRoadmapData = (data: RoadmapData) => {
    setItems(data.items);
    setGeneratedAt(data.generatedAt);
  };

  const openCreateForm = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEditForm = (item: RoadmapItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  async function handleSave(item: RoadmapItem): Promise<RoadmapItem> {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const isEdit = item.id !== "new" && items.some((entry) => entry.id === item.id);
      const response = await fetch(isEdit ? `/api/roadmap/${item.id}` : "/api/roadmap", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemPayload(item)),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save roadmap item");
      }

      const data = (await response.json()) as RoadmapData;
      applyRoadmapData(data);
      const saved = resolveSavedItem(data, item);
      setEditingItem(saved);
      return saved;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save roadmap item");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function syncGitLabHours() {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/roadmap/gitlab/sync-hours", { method: "POST" });
      if (!response.ok) throw new Error("Failed to sync GitLab hours");
      const data = (await response.json()) as RoadmapData;
      applyRoadmapData(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to sync GitLab hours");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleDelete(item: RoadmapItem) {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/roadmap/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete roadmap item");
      }

      const data = (await response.json()) as RoadmapData;
      applyRoadmapData(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete roadmap item");
    }
  }

  const resetFilters = () => {
    setFilters(DEFAULT_ROADMAP_FILTERS);
    setSort(DEFAULT_ROADMAP_SORT);
  };

  async function refreshFromApi() {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/roadmap");
      if (!response.ok) throw new Error("Failed to refresh roadmap data");
      const data = (await response.json()) as RoadmapData;
      applyRoadmapData(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to refresh roadmap data");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function reimportFromWorkbook() {
    setIsImporting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/roadmap/import", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to import FY27 V1 workbook");
      }
      const data = (await response.json()) as RoadmapData;
      applyRoadmapData(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import FY27 V1 workbook",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <AppHeader
        title="Roadmap Maintenance"
        description={`${sourceSheet} · Updated ${formatRelativeDate(generatedAt)}`}
        actions={
          <Group gap="sm">
            <Badge variant="outline">{items.length} items</Badge>
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => void syncGitLabHours()}
              disabled={isRefreshing || isImporting}
            >
              Sync GitLab hours
            </Button>
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => void refreshFromApi()}
              disabled={isRefreshing || isImporting}
              leftSection={
                isRefreshing ? <Loader size={14} color="gray" /> : undefined
              }
            >
              Refresh
            </Button>
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => void reimportFromWorkbook()}
              disabled={isRefreshing || isImporting}
              leftSection={
                isImporting ? (
                  <Loader size={14} color="gray" />
                ) : (
                  <IconRefresh size={16} />
                )
              }
            >
              Import FY27 V1
            </Button>
            <Button
              size="compact-sm"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateForm}
            >
              Add item
            </Button>
          </Group>
        }
      />

      <Stack gap="lg" p="md" px={{ base: "md", lg: "xl" }} pb="xl">
        {errorMessage ? (
          <Alert color="red" title="Roadmap error" withCloseButton onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        ) : null}

        <RoadmapSummaryCards summary={summary} loading={isRefreshing || isImporting} />

        <RoadmapFilters
          filters={filters}
          sort={sort}
          options={filterOptions}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onReset={resetFilters}
        />

        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600}>Roadmap items</Text>
              <Text size="sm" c="dimmed">
                Showing {filteredItems.length} of {items.length} items from {sourceSheet}
              </Text>
            </div>
          </Group>

          <RoadmapTable
            items={filteredItems}
            loading={isRefreshing || isImporting}
            onEdit={openEditForm}
            onDelete={(item) => void handleDelete(item)}
          />
        </Paper>
      </Stack>

      <RoadmapForm
        opened={formOpen}
        item={editingItem}
        saving={isSaving}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        onGitLabLinked={(linked) => {
          setEditingItem(linked);
          setItems((current) =>
            current.map((entry) => (entry.id === linked.id ? linked : entry)),
          );
        }}
      />
    </>
  );
}

function itemPayload(item: RoadmapItem) {
  return {
    priority: item.priority,
    include: item.include,
    project: item.project,
    category: item.category,
    quarter: item.quarter,
    timeline: item.timeline,
    assignee: item.assignee,
    hours: item.hours,
    core: item.core,
    mobile: item.mobile,
    data: item.data,
    title: item.title,
    description: item.description,
    gitlab: item.gitlab,
    hoursSpent: item.hoursSpent,
  };
}

function resolveSavedItem(data: RoadmapData, draft: RoadmapItem): RoadmapItem {
  if (draft.id !== "new") {
    return data.items.find((entry) => entry.id === draft.id) ?? draft;
  }

  return (
    data.items.find(
      (entry) =>
        entry.title === draft.title &&
        entry.project === draft.project &&
        entry.quarter === draft.quarter,
    ) ??
    data.items[0] ??
    draft
  );
}

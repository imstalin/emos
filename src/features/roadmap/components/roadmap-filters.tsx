"use client";

import {
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

import type { RoadmapFiltersState, RoadmapSortState } from "@/domain/types/roadmap";

interface RoadmapFiltersProps {
  filters: RoadmapFiltersState;
  sort: RoadmapSortState;
  options: {
    projects: string[];
    quarters: string[];
    categories: string[];
    assignees: string[];
    priorities: string[];
  };
  onFiltersChange: (filters: RoadmapFiltersState) => void;
  onSortChange: (sort: RoadmapSortState) => void;
  onReset: () => void;
}

const ALL_OPTION = { value: "ALL", label: "All" };

function withAllOptions(values: string[]) {
  return [ALL_OPTION, ...values.map((value) => ({ value, label: value }))];
}

export function RoadmapFilters({
  filters,
  sort,
  options,
  onFiltersChange,
  onSortChange,
  onReset,
}: RoadmapFiltersProps) {
  const updateFilter = <K extends keyof RoadmapFiltersState>(
    key: K,
    value: RoadmapFiltersState[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>Filters & sorting</Text>
          <Text
            component="button"
            type="button"
            size="sm"
            c="blue"
            style={{ background: "none", border: 0, cursor: "pointer" }}
            onClick={onReset}
          >
            Reset filters
          </Text>
        </Group>

        <TextInput
          placeholder="Search title or description…"
          leftSection={<IconSearch size={16} />}
          value={filters.search}
          onChange={(event) => updateFilter("search", event.currentTarget.value)}
        />

        <Group grow align="flex-start">
          <Select
            label="Project"
            value={filters.project}
            onChange={(value) => updateFilter("project", value ?? "ALL")}
            data={withAllOptions(options.projects)}
            searchable
            clearable={false}
          />
          <Select
            label="Quarter"
            value={filters.quarter}
            onChange={(value) => updateFilter("quarter", value ?? "ALL")}
            data={withAllOptions(options.quarters)}
            searchable
            clearable={false}
          />
          <Select
            label="Priority"
            value={filters.priority}
            onChange={(value) => updateFilter("priority", value ?? "ALL")}
            data={withAllOptions(options.priorities)}
            clearable={false}
          />
        </Group>

        <Group grow align="flex-start">
          <Select
            label="Category"
            value={filters.category}
            onChange={(value) => updateFilter("category", value ?? "ALL")}
            data={withAllOptions(options.categories)}
            searchable
            clearable={false}
          />
          <Select
            label="Assignee"
            value={filters.assignee}
            onChange={(value) => updateFilter("assignee", value ?? "ALL")}
            data={withAllOptions(options.assignees)}
            searchable
            clearable={false}
          />
          <Select
            label="Include"
            value={filters.include}
            onChange={(value) => updateFilter("include", value ?? "ALL")}
            data={withAllOptions(["Yes", "No", "Pending"])}
            clearable={false}
          />
        </Group>

        <Group grow align="flex-end">
          <Select
            label="Sort by"
            value={sort.field}
            onChange={(value) =>
              onSortChange({
                ...sort,
                field: (value as RoadmapSortState["field"]) ?? "priority",
              })
            }
            data={[
              { value: "priority", label: "Priority" },
              { value: "quarter", label: "Quarter" },
              { value: "hours", label: "Hours" },
            ]}
          />
          <Select
            label="Direction"
            value={sort.direction}
            onChange={(value) =>
              onSortChange({
                ...sort,
                direction: (value as RoadmapSortState["direction"]) ?? "asc",
              })
            }
            data={[
              { value: "asc", label: "Ascending" },
              { value: "desc", label: "Descending" },
            ]}
          />
        </Group>
      </Stack>
    </Paper>
  );
}

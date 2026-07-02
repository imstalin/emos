"use client";

import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Group,
  ScrollArea,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconEdit, IconExternalLink, IconTrash } from "@tabler/icons-react";

import type { RoadmapItem } from "@/domain/types/roadmap";
import {
  formatRoadmapHours,
  getIncludeBadgeColor,
  getPriorityBadgeColor,
} from "@/features/roadmap/lib/roadmap-utils";

interface RoadmapTableProps {
  items: RoadmapItem[];
  loading?: boolean;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
}

export function RoadmapTable({
  items,
  loading,
  onEdit,
  onDelete,
}: RoadmapTableProps) {
  if (loading) {
    return (
      <Box p="xl">
        <Text c="dimmed" ta="center">
          Loading roadmap items…
        </Text>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box p="xl">
        <Text fw={600} ta="center">
          No roadmap items found
        </Text>
        <Text c="dimmed" ta="center" size="sm" mt={4}>
          Try adjusting filters or add a new roadmap item.
        </Text>
      </Box>
    );
  }

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priority</Table.Th>
            <Table.Th>Include</Table.Th>
            <Table.Th>Project</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Quarter</Table.Th>
            <Table.Th>Timeline</Table.Th>
            <Table.Th>Assignee</Table.Th>
            <Table.Th>Hours</Table.Th>
            <Table.Th>Spent</Table.Th>
            <Table.Th>GitLab</Table.Th>
            <Table.Th>Core</Table.Th>
            <Table.Th>Mobile</Table.Th>
            <Table.Th>Data</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th w={90}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Badge color={getPriorityBadgeColor(item.priority)} variant="light">
                  {item.priority}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={getIncludeBadgeColor(item.include)} variant="outline">
                  {item.include}
                </Badge>
              </Table.Td>
              <Table.Td>{item.project}</Table.Td>
              <Table.Td>{item.category}</Table.Td>
              <Table.Td>{item.quarter}</Table.Td>
              <Table.Td>{item.timeline}</Table.Td>
              <Table.Td>{item.assignee || "—"}</Table.Td>
              <Table.Td>{formatRoadmapHours(item.hours)}</Table.Td>
              <Table.Td>
                {item.gitlab ? `${item.hoursSpent ?? 0}h` : "—"}
              </Table.Td>
              <Table.Td>
                {item.gitlab ? (
                  <Tooltip label={`Issue #${item.gitlab.issueIid}`}>
                    <ActionIcon
                      component="a"
                      href={item.gitlab.issueUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="subtle"
                      color="blue"
                      aria-label={`Open GitLab issue #${item.gitlab.issueIid}`}
                    >
                      <IconExternalLink size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </Table.Td>
              <Table.Td>
                <Checkbox checked={item.core} readOnly aria-label="Core" />
              </Table.Td>
              <Table.Td>
                <Checkbox checked={item.mobile} readOnly aria-label="Mobile" />
              </Table.Td>
              <Table.Td>
                <Checkbox checked={item.data} readOnly aria-label="Data" />
              </Table.Td>
              <Table.Td maw={220}>
                <Text size="sm" lineClamp={2}>
                  {item.title}
                </Text>
              </Table.Td>
              <Table.Td maw={280}>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {item.description || "—"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Edit item">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.title}`}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete item">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${item.title}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

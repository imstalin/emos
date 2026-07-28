"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Group,
  ScrollArea,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import {
  IconBrandGitlab,
  IconEdit,
  IconExternalLink,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";

import type { RoadmapItem } from "@/domain/types/roadmap";
import {
  formatRoadmapHours,
  getIncludeBadgeColor,
  getPriorityBadgeColor,
} from "@/features/roadmap/lib/roadmap-utils";

interface RoadmapTableProps {
  items: RoadmapItem[];
  loading?: boolean;
  aiItemId?: string | null;
  gitlabItemId?: string | null;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
  onSaveFields: (
    item: RoadmapItem,
    patch: { title: string; description: string },
  ) => Promise<void>;
  onAiGenerate: (item: RoadmapItem) => Promise<void>;
  onCreateGitLab: (item: RoadmapItem) => void;
}

export function RoadmapTable({
  items,
  loading,
  aiItemId,
  gitlabItemId,
  onEdit,
  onDelete,
  onSaveFields,
  onAiGenerate,
  onCreateGitLab,
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
            <Table.Th miw={220}>Title</Table.Th>
            <Table.Th miw={280}>Description</Table.Th>
            <Table.Th>Quarter</Table.Th>
            <Table.Th>Timeline</Table.Th>
            <Table.Th>Assignee</Table.Th>
            <Table.Th>Hours</Table.Th>
            <Table.Th>Spent</Table.Th>
            <Table.Th>GitLab</Table.Th>
            <Table.Th>Core</Table.Th>
            <Table.Th>Mobile</Table.Th>
            <Table.Th>Data</Table.Th>
            <Table.Th w={140}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <RoadmapTableRow
              key={item.id}
              item={item}
              aiLoading={aiItemId === item.id}
              gitlabLoading={gitlabItemId === item.id}
              onEdit={onEdit}
              onDelete={onDelete}
              onSaveFields={onSaveFields}
              onAiGenerate={onAiGenerate}
              onCreateGitLab={onCreateGitLab}
            />
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

function RoadmapTableRow({
  item,
  aiLoading,
  gitlabLoading,
  onEdit,
  onDelete,
  onSaveFields,
  onAiGenerate,
  onCreateGitLab,
}: {
  item: RoadmapItem;
  aiLoading: boolean;
  gitlabLoading: boolean;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
  onSaveFields: (
    item: RoadmapItem,
    patch: { title: string; description: string },
  ) => Promise<void>;
  onAiGenerate: (item: RoadmapItem) => Promise<void>;
  onCreateGitLab: (item: RoadmapItem) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [savingFields, setSavingFields] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description);
  }, [item.id, item.title, item.description]);

  async function persistIfChanged() {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (!nextTitle) {
      setTitle(item.title);
      return;
    }
    if (nextTitle === item.title && nextDescription === item.description) {
      return;
    }

    setSavingFields(true);
    try {
      await onSaveFields(item, {
        title: nextTitle,
        description: nextDescription,
      });
    } finally {
      setSavingFields(false);
    }
  }

  return (
    <Table.Tr>
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
      <Table.Td>
        <TextInput
          size="xs"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          onBlur={() => void persistIfChanged()}
          aria-label={`Title for ${item.id}`}
          disabled={savingFields}
        />
      </Table.Td>
      <Table.Td>
        <Textarea
          size="xs"
          minRows={2}
          autosize
          maxRows={6}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          onBlur={() => void persistIfChanged()}
          placeholder="Description for AI / GitLab issue body"
          aria-label={`Description for ${item.title || item.id}`}
          disabled={savingFields || aiLoading}
        />
      </Table.Td>
      <Table.Td>{item.quarter}</Table.Td>
      <Table.Td>{item.timeline}</Table.Td>
      <Table.Td>{item.assignee || "—"}</Table.Td>
      <Table.Td>{formatRoadmapHours(item.hours)}</Table.Td>
      <Table.Td>{item.gitlab ? `${item.hoursSpent ?? 0}h` : "—"}</Table.Td>
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
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="AI generate description from title">
            <ActionIcon
              variant="subtle"
              color="violet"
              loading={aiLoading}
              disabled={!title.trim() || savingFields}
              onClick={() => void onAiGenerate({ ...item, title, description })}
              aria-label={`AI generate description for ${item.title}`}
            >
              <IconSparkles size={16} />
            </ActionIcon>
          </Tooltip>
          {!item.gitlab ? (
            <Tooltip label="Create GitLab ticket (uses Title + Description)">
              <ActionIcon
                variant="subtle"
                color="orange"
                loading={gitlabLoading}
                disabled={!title.trim() || savingFields}
                onClick={() =>
                  onCreateGitLab({ ...item, title: title.trim(), description: description.trim() })
                }
                aria-label={`Create GitLab ticket for ${item.title}`}
              >
                <IconBrandGitlab size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Tooltip label="Edit full item">
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
  );
}

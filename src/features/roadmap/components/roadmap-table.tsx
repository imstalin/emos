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

interface RoadmapFieldPatch {
  title: string;
  description: string;
  aiTitle: string;
  aiDescription: string;
}

interface RoadmapTableProps {
  items: RoadmapItem[];
  loading?: boolean;
  aiItemId?: string | null;
  gitlabItemId?: string | null;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
  onSaveFields: (item: RoadmapItem, patch: RoadmapFieldPatch) => Promise<void>;
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
            <Table.Th miw={200}>Title</Table.Th>
            <Table.Th miw={220}>Description</Table.Th>
            <Table.Th miw={200}>AI Title</Table.Th>
            <Table.Th miw={240}>AI Description</Table.Th>
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
  onSaveFields: (item: RoadmapItem, patch: RoadmapFieldPatch) => Promise<void>;
  onAiGenerate: (item: RoadmapItem) => Promise<void>;
  onCreateGitLab: (item: RoadmapItem) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [aiTitle, setAiTitle] = useState(item.aiTitle);
  const [aiDescription, setAiDescription] = useState(item.aiDescription);
  const [savingFields, setSavingFields] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description);
    setAiTitle(item.aiTitle);
    setAiDescription(item.aiDescription);
  }, [item.id, item.title, item.description, item.aiTitle, item.aiDescription]);

  async function persistIfChanged() {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextAiTitle = aiTitle.trim();
    const nextAiDescription = aiDescription.trim();
    if (!nextTitle) {
      setTitle(item.title);
      return;
    }
    if (
      nextTitle === item.title &&
      nextDescription === item.description &&
      nextAiTitle === item.aiTitle &&
      nextAiDescription === item.aiDescription
    ) {
      return;
    }

    setSavingFields(true);
    try {
      await onSaveFields(item, {
        title: nextTitle,
        description: nextDescription,
        aiTitle: nextAiTitle,
        aiDescription: nextAiDescription,
      });
    } finally {
      setSavingFields(false);
    }
  }

  const draftItem: RoadmapItem = {
    ...item,
    title: title.trim(),
    description: description.trim(),
    aiTitle: aiTitle.trim(),
    aiDescription: aiDescription.trim(),
  };

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
          placeholder="Planning description"
          aria-label={`Description for ${item.title || item.id}`}
          disabled={savingFields || aiLoading}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          value={aiTitle}
          onChange={(event) => setAiTitle(event.currentTarget.value)}
          onBlur={() => void persistIfChanged()}
          placeholder="GitLab title"
          aria-label={`AI title for ${item.id}`}
          disabled={savingFields || aiLoading}
        />
      </Table.Td>
      <Table.Td>
        <Textarea
          size="xs"
          minRows={2}
          autosize
          maxRows={6}
          value={aiDescription}
          onChange={(event) => setAiDescription(event.currentTarget.value)}
          onBlur={() => void persistIfChanged()}
          placeholder="GitLab description"
          aria-label={`AI description for ${item.title || item.id}`}
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
          <Tooltip label="AI generate GitLab title + description">
            <ActionIcon
              variant="subtle"
              color="violet"
              loading={aiLoading}
              disabled={!title.trim() || savingFields}
              onClick={() => void onAiGenerate(draftItem)}
              aria-label={`AI generate for ${item.title}`}
            >
              <IconSparkles size={16} />
            </ActionIcon>
          </Tooltip>
          {!item.gitlab ? (
            <Tooltip label="Create GitLab ticket (uses AI Title + AI Description)">
              <ActionIcon
                variant="subtle"
                color="orange"
                loading={gitlabLoading}
                disabled={
                  !title.trim() ||
                  savingFields ||
                  (!aiTitle.trim() && !aiDescription.trim())
                }
                onClick={() => onCreateGitLab(draftItem)}
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

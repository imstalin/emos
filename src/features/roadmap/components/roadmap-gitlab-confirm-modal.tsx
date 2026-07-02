"use client";

import {
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";

import type { RoadmapGitLabIssuePreview } from "@/domain/types/roadmap-gitlab";

interface RoadmapGitLabConfirmModalProps {
  opened: boolean;
  preview: RoadmapGitLabIssuePreview | null;
  loading?: boolean;
  creating?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RoadmapGitLabConfirmModal({
  opened,
  preview,
  loading,
  creating,
  onClose,
  onConfirm,
}: RoadmapGitLabConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Confirm GitLab issue creation"
      size="lg"
      centered
    >
      {loading || !preview ? (
        <Text c="dimmed" size="sm">
          Preparing preview…
        </Text>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Review the issue that will be created in project{" "}
            <strong>
              {preview.projectName} ({preview.projectId})
            </strong>
            . Nothing is sent to GitLab until you confirm.
          </Text>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Title
            </Text>
            <Text size="sm">{preview.title}</Text>
          </Stack>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Labels
            </Text>
            <Group gap={6}>
              {preview.labels.map((label) => (
                <Badge key={label} variant="light">
                  {label}
                </Badge>
              ))}
            </Group>
          </Stack>

          <Group grow>
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Milestone
              </Text>
              <Text size="sm">{preview.milestoneTitle ?? "None"}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Parent epic
              </Text>
              <Text size="sm">
                {preview.parentEpicTitle
                  ? `#${preview.parentEpicIid} ${preview.parentEpicTitle}`
                  : "No open monthly epic found for this stream"}
              </Text>
            </Stack>
          </Group>

          <Group grow>
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Weight
              </Text>
              <Text size="sm">{preview.weight ?? "—"}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Est. hours
              </Text>
              <Text size="sm">
                {preview.estimatedHours != null ? `${preview.estimatedHours}h` : "TBD"}
              </Text>
            </Stack>
          </Group>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Assignee
            </Text>
            <Text size="sm">
              {preview.assigneeGitLabUsername
                ? `${preview.assigneeName} (@${preview.assigneeGitLabUsername})`
                : preview.assigneeName || "Unassigned"}
            </Text>
          </Stack>

          <Textarea
            label="Description preview"
            value={preview.description}
            readOnly
            minRows={8}
            autosize
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button color="blue" onClick={onConfirm} loading={creating}>
              Create GitLab issue
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

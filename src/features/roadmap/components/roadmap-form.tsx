"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";

import {
  ROADMAP_CATEGORIES,
  ROADMAP_INCLUDE_OPTIONS,
  ROADMAP_PRIORITIES,
  ROADMAP_PROJECTS,
  type RoadmapHours,
  type RoadmapItem,
} from "@/domain/types/roadmap";
import type { RoadmapGitLabIssuePreview } from "@/domain/types/roadmap-gitlab";
import { RoadmapGitLabConfirmModal } from "@/features/roadmap/components/roadmap-gitlab-confirm-modal";
import { createEmptyRoadmapItem } from "@/features/roadmap/lib/roadmap-utils";

interface RoadmapFormValues {
  priority: RoadmapItem["priority"];
  include: RoadmapItem["include"];
  project: string;
  category: string;
  quarter: string;
  timeline: string;
  assignee: string;
  hours: string;
  core: boolean;
  mobile: boolean;
  data: boolean;
  title: string;
  description: string;
}

interface RoadmapFormProps {
  opened: boolean;
  item: RoadmapItem | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (item: RoadmapItem) => Promise<RoadmapItem>;
  onGitLabLinked?: (item: RoadmapItem) => void;
}

function toFormValues(item: RoadmapItem | null): RoadmapFormValues {
  const base = item ?? { ...createEmptyRoadmapItem(), id: "new" };
  return {
    priority: base.priority,
    include: base.include,
    project: base.project,
    category: base.category,
    quarter: base.quarter,
    timeline: base.timeline,
    assignee: base.assignee,
    hours: base.hours === "TBD" ? "TBD" : String(base.hours),
    core: base.core,
    mobile: base.mobile,
    data: base.data,
    title: base.title,
    description: base.description,
  };
}

function parseHoursInput(value: string): RoadmapHours {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "TBD") return "TBD";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Hours must be a number or TBD");
  }
  return parsed;
}

function buildItemFromForm(
  values: RoadmapFormValues,
  existing: RoadmapItem | null,
): RoadmapItem {
  return {
    id: existing?.id ?? "new",
    priority: values.priority,
    include: values.include,
    project: values.project.trim(),
    category: values.category.trim(),
    quarter: values.quarter.trim(),
    timeline: values.timeline.trim() || `${values.quarter.trim()} FY27`,
    assignee: values.assignee.trim(),
    hours: parseHoursInput(values.hours),
    core: values.core,
    mobile: values.mobile,
    data: values.data,
    title: values.title.trim(),
    description: values.description.trim(),
    gitlab: existing?.gitlab,
    hoursSpent: existing?.hoursSpent,
  };
}

export function RoadmapForm({
  opened,
  item,
  saving = false,
  onClose,
  onSave,
  onGitLabLinked,
}: RoadmapFormProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [gitlabPreviewOpen, setGitlabPreviewOpen] = useState(false);
  const [gitlabPreview, setGitlabPreview] = useState<RoadmapGitLabIssuePreview | null>(
    null,
  );
  const [gitlabPreviewLoading, setGitlabPreviewLoading] = useState(false);
  const [gitlabCreating, setGitlabCreating] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(item?.id ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [linkedIssueUrl, setLinkedIssueUrl] = useState<string | null>(null);
  const [linkedItem, setLinkedItem] = useState<RoadmapItem | null>(null);

  const form = useForm<RoadmapFormValues>({
    initialValues: toFormValues(item),
    validate: {
      priority: (value) => (value ? null : "Priority is required"),
      project: (value) => (value.trim() ? null : "Project is required"),
      category: (value) => (value.trim() ? null : "Category is required"),
      quarter: (value) => (value.trim() ? null : "Quarter is required"),
      title: (value) => (value.trim() ? null : "Title is required"),
      hours: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "Hours is required";
        if (trimmed.toUpperCase() === "TBD") return null;
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return "Enter a valid number or TBD";
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (!opened) {
      setGitlabPreviewOpen(false);
      setGitlabPreview(null);
      return;
    }

    form.setValues(toFormValues(item));
    form.clearErrors();
    setSavedItemId(item?.id ?? null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLinkedIssueUrl(null);
    setLinkedItem(null);
    setGitlabPreviewOpen(false);
    setGitlabPreview(null);
  }, [opened, item?.id]);

  const currentItem = buildItemFromForm(form.values, {
    ...(item ?? { ...createEmptyRoadmapItem(), id: savedItemId ?? "new" }),
    id: savedItemId ?? item?.id ?? "new",
    gitlab: item?.gitlab,
    hoursSpent: item?.hoursSpent,
  });

  async function runAi(mode: "generate" | "rewrite") {
    setAiLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/roadmap/ai/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          title: form.values.title,
          description: form.values.description,
          project: form.values.project,
          category: form.values.category,
          priority: form.values.priority,
          quarter: form.values.quarter,
          assignee: form.values.assignee,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "AI request failed");
      }

      const data = (await response.json()) as { description: string };
      form.setFieldValue("description", data.description);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function openGitLabPreview() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!form.values.title.trim()) {
      setErrorMessage("Add a title before creating a GitLab issue");
      return;
    }

    setGitlabPreviewOpen(true);
    setGitlabPreviewLoading(true);
    setGitlabPreview(null);

    try {
      let draft = buildItemFromForm(form.values, currentItem);
      draft = await onSave(draft);
      setSavedItemId(draft.id);

      const response = await fetch("/api/roadmap/gitlab/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to preview GitLab issue");
      }

      const data = (await response.json()) as {
        preview?: RoadmapGitLabIssuePreview;
      } & Partial<RoadmapGitLabIssuePreview>;

      const preview = data.preview ?? (data.projectId ? (data as RoadmapGitLabIssuePreview) : null);
      if (!preview) {
        throw new Error("Preview response was empty");
      }

      setGitlabPreview(preview);
    } catch (error) {
      setGitlabPreviewOpen(false);
      setErrorMessage(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setGitlabPreviewLoading(false);
    }
  }

  async function confirmGitLabCreate() {
    if (!savedItemId || savedItemId === "new") {
      setErrorMessage("Save the roadmap item before creating a GitLab issue");
      return;
    }

    setGitlabCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/roadmap/gitlab/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: savedItemId, confirmed: true }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create GitLab issue");
      }

      const data = (await response.json()) as {
        item: RoadmapItem;
        issue: { iid: number; webUrl: string; title: string };
      };

      setGitlabPreviewOpen(false);
      setSuccessMessage(
        `Created GitLab issue #${data.issue.iid}. Track time in GitLab to update hours spent.`,
      );
      setLinkedIssueUrl(data.issue.webUrl);
      setLinkedItem(data.item);
      onGitLabLinked?.(data.item);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Create failed");
    } finally {
      setGitlabCreating(false);
    }
  }

  const handleSubmit = form.onSubmit(async (values) => {
    const savedItem = buildItemFromForm(values, currentItem);
    await onSave(savedItem);
    onClose();
  });

  const activeItem = linkedItem ?? item;
  const hasGitLabLink = Boolean(activeItem?.gitlab);

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={item ? "Edit roadmap item" : "Add roadmap item"}
        position="right"
        size="lg"
        padding="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {errorMessage ? (
              <Alert color="red" title="Error" withCloseButton onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            ) : null}
            {successMessage ? (
              <Alert color="green" title="GitLab issue created">
                {successMessage}
                {linkedIssueUrl ? (
                  <>
                    {" "}
                    <Anchor href={linkedIssueUrl} target="_blank" rel="noreferrer">
                      Open issue
                    </Anchor>
                  </>
                ) : null}
              </Alert>
            ) : null}

            {hasGitLabLink && activeItem?.gitlab ? (
              <Alert color="blue" title="Linked GitLab issue">
                <Stack gap={4}>
                  <Text size="sm">
                    Issue #{activeItem.gitlab.issueIid} in project {activeItem.gitlab.projectId}
                  </Text>
                  <Anchor
                    href={activeItem.gitlab.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    size="sm"
                  >
                    {activeItem.gitlab.issueUrl}
                  </Anchor>
                  <Text size="sm">
                    Hours spent: {activeItem.hoursSpent ?? 0}h (sync from GitLab timelogs)
                  </Text>
                </Stack>
              </Alert>
            ) : null}

            <Group grow>
              <Select
                label="Priority"
                required
                data={ROADMAP_PRIORITIES}
                {...form.getInputProps("priority")}
              />
              <Select
                label="Include"
                data={ROADMAP_INCLUDE_OPTIONS}
                {...form.getInputProps("include")}
              />
            </Group>

            <Group grow>
              <Select
                label="Project"
                required
                searchable
                data={[...ROADMAP_PROJECTS]}
                {...form.getInputProps("project")}
              />
              <Select
                label="Category"
                required
                searchable
                data={[...ROADMAP_CATEGORIES]}
                {...form.getInputProps("category")}
              />
            </Group>

            <Group grow>
              <TextInput label="Quarter" required {...form.getInputProps("quarter")} />
              <TextInput label="Timeline" {...form.getInputProps("timeline")} />
            </Group>

            <Group grow>
              <TextInput label="Assignee" {...form.getInputProps("assignee")} />
              <TextInput
                label="Hours"
                placeholder="Number or TBD"
                required
                {...form.getInputProps("hours")}
              />
            </Group>

            <Group>
              <Checkbox label="Core" {...form.getInputProps("core", { type: "checkbox" })} />
              <Checkbox
                label="Mobile"
                {...form.getInputProps("mobile", { type: "checkbox" })}
              />
              <Checkbox label="Data" {...form.getInputProps("data", { type: "checkbox" })} />
            </Group>

            <TextInput label="Title" required {...form.getInputProps("title")} />

            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Description
                </Text>
                <Group gap="xs">
                  <Button
                    type="button"
                    variant="light"
                    size="compact-sm"
                    loading={aiLoading}
                    onClick={() => void runAi("generate")}
                  >
                    AI generate
                  </Button>
                  <Button
                    type="button"
                    variant="light"
                    size="compact-sm"
                    loading={aiLoading}
                    disabled={!form.values.description.trim()}
                    onClick={() => void runAi("rewrite")}
                  >
                    AI rewrite
                  </Button>
                </Group>
              </Group>
              <Textarea minRows={4} autosize {...form.getInputProps("description")} />
            </Stack>

            {!hasGitLabLink ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void openGitLabPreview()}
                disabled={saving || gitlabPreviewLoading || gitlabCreating}
              >
                Preview GitLab issue (admin 6100)
              </Button>
            ) : null}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose} type="button" disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <RoadmapGitLabConfirmModal
        opened={gitlabPreviewOpen}
        preview={gitlabPreview}
        loading={gitlabPreviewLoading}
        creating={gitlabCreating}
        onClose={() => setGitlabPreviewOpen(false)}
        onConfirm={() => void confirmGitLabCreate()}
      />
    </>
  );
}

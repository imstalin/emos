"use client";

import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCalendarStats,
  IconCategory,
  IconClockHour4,
  IconListDetails,
} from "@tabler/icons-react";

import type { RoadmapSummary } from "@/domain/types/roadmap";

interface RoadmapSummaryCardsProps {
  summary: RoadmapSummary;
  loading?: boolean;
}

export function RoadmapSummaryCards({ summary, loading }: RoadmapSummaryCardsProps) {
  if (loading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} withBorder radius="md" padding="lg" h={120} />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <SummaryCard
        title="Total items"
        value={String(summary.totalItems)}
        description="All FY27 roadmap backlog items"
        icon={IconListDetails}
        color="blue"
      />
      <SummaryCard
        title="Critical items"
        value={String(summary.criticalItems)}
        description="Highest urgency work"
        icon={IconAlertTriangle}
        color="red"
      />
      <SummaryCard
        title="High priority"
        value={String(summary.highPriorityItems)}
        description="High priority backlog items"
        icon={IconAlertTriangle}
        color="orange"
      />
      <SummaryCard
        title="Estimated hours"
        value={String(summary.totalEstimatedHours)}
        description={
          summary.tbdHoursCount > 0
            ? `${summary.tbdHoursCount} items with TBD hours`
            : "Numeric hour estimates only"
        }
        icon={IconClockHour4}
        color="teal"
      />
      <SummaryCard
        title="Hours spent"
        value={String(summary.totalHoursSpent)}
        description={`${summary.linkedGitLabIssues} linked GitLab issues`}
        icon={IconClockHour4}
        color="cyan"
      />
      <SummaryCard
        title="Items by quarter"
        value={String(summary.byQuarter.length)}
        description="Distinct quarter buckets"
        icon={IconCalendarStats}
        color="indigo"
        footer={
          <Group gap={6} mt="xs">
            {summary.byQuarter.slice(0, 4).map((row) => (
              <Badge key={row.quarter} variant="light" color="indigo">
                {row.quarter}: {row.count}
              </Badge>
            ))}
          </Group>
        }
      />
      <SummaryCard
        title="Items by category"
        value={String(summary.byCategory.length)}
        description="Work type distribution"
        icon={IconCategory}
        color="grape"
        footer={
          <Group gap={6} mt="xs">
            {summary.byCategory.slice(0, 3).map((row) => (
              <Badge key={row.category} variant="light" color="grape">
                {row.category}: {row.count}
              </Badge>
            ))}
          </Group>
        }
      />
    </SimpleGrid>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  footer,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {title}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
          {footer}
        </Stack>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

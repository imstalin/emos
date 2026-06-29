import type { ProductBacklogData } from "@/domain/types/product-backlog";
import { getDemoDashboardMetrics } from "@/server/services/dashboard/demo-data";

export function getDemoProductBacklogData(): ProductBacklogData {
  const metrics = getDemoDashboardMetrics();
  const tasks = metrics.productBacklog.tasks.map((item) => ({
    ...item,
    gitlabIid: null,
    storyPoints: null,
    typeLabel: item.labels.find((label) => /^type::/i.test(label))?.split("::")[1] ?? null,
    lastActivityAt: null,
  }));
  const defects = metrics.productBacklog.defects.map((item) => ({
    ...item,
    gitlabIid: null,
    storyPoints: null,
    typeLabel: "Defect",
    lastActivityAt: null,
  }));

  const all = [...tasks, ...defects];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      tasks: tasks.length,
      defects: defects.length,
      total: all.length,
      critical: all.filter((item) => item.priority === "CRITICAL").length,
      high: all.filter((item) => item.priority === "HIGH").length,
      unassigned: all.filter((item) => !item.assigneeName).length,
      byProject: [
        {
          projectName: "Release Observations",
          count: all.length,
        },
      ],
    },
    tasks,
    defects,
  };
}

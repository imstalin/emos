import type { GovernanceRule } from "@prisma/client";

import type {
  GovernanceReport,
  GovernanceViolation,
} from "@/domain/types/governance";
import { db } from "@/lib/db";
import { evaluateGovernanceRule } from "@/server/services/governance/governance.rules";
import {
  buildMonitoredProjectWhere,
  mergeWorkItemWhere,
} from "@/server/services/gitlab/monitored-projects";

type WorkItemForGovernance = {
  id: string;
  title: string;
  type: string;
  state: string;
  priority: string;
  storyPoints: number | null;
  labels: string[];
  dueDate: Date | null;
  lastActivityAt: Date | null;
  reviewStatus: string | null;
  webUrl: string | null;
  project: { name: string };
  assignee: { name: string } | null;
};

export class GovernanceService {
  async getReport(): Promise<GovernanceReport> {
    const monitoredWhere = await buildMonitoredProjectWhere();
    const [rules, workItems] = await Promise.all([
      db.governanceRule.findMany({
        where: { isEnabled: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      db.workItem.findMany({
        where: mergeWorkItemWhere(
          { state: { notIn: ["DONE", "CLOSED"] } },
          monitoredWhere,
        ),
        include: {
          project: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      }),
    ]);

    const violations: GovernanceViolation[] = [];

    for (const item of workItems) {
      for (const rule of rules) {
        if (this.evaluateRule(rule, item)) {
          violations.push(this.toViolation(rule, item));
        }
      }
    }

    const violationsBySeverity = {
      error: violations.filter((violation) => violation.severity === "error").length,
      warning: violations.filter((violation) => violation.severity === "warning").length,
      info: violations.filter((violation) => violation.severity === "info").length,
    };

    const violationsByCategory: Record<string, number> = {};
    for (const violation of violations) {
      violationsByCategory[violation.category] =
        (violationsByCategory[violation.category] ?? 0) + 1;
    }

    const ruleSummaries = rules.map((rule) => ({
      id: rule.id,
      slug: rule.slug,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      description: rule.description,
      violationCount: violations.filter((violation) => violation.ruleId === rule.id).length,
    }));

    const score = this.computeScore(workItems.length, violations.length);

    return {
      generatedAt: new Date().toISOString(),
      score,
      totalItems: workItems.length,
      violationCount: violations.length,
      violationsBySeverity,
      violationsByCategory,
      rules: ruleSummaries,
      violations: violations.sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const aOrder =
          severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
        const bOrder =
          severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
        return aOrder - bOrder;
      }),
    };
  }

  private evaluateRule(
    rule: GovernanceRule,
    item: WorkItemForGovernance,
  ): boolean {
    const config = (rule.config as { maxStoryPoints?: number; inactiveDays?: number } | null) ?? {};
    return evaluateGovernanceRule(rule.slug, item, config);
  }

  private toViolation(
    rule: GovernanceRule,
    item: WorkItemForGovernance,
  ): GovernanceViolation {
    return {
      ruleId: rule.id,
      ruleSlug: rule.slug,
      ruleName: rule.name,
      severity: rule.severity,
      category: rule.category,
      description: rule.description,
      workItemId: item.id,
      workItemTitle: item.title,
      workItemType: item.type,
      projectName: item.project.name,
      assigneeName: item.assignee?.name ?? null,
      webUrl: item.webUrl,
    };
  }

  private computeScore(totalItems: number, violationCount: number): number {
    if (totalItems === 0) return 100;
    const violationsPerItem = violationCount / totalItems;
    return Math.max(0, Math.round(100 - violationsPerItem * 12));
  }
}

export const governanceService = new GovernanceService();

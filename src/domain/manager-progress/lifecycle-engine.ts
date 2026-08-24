import type { LifecycleStage } from "@/domain/types/manager-progress";
import { DEFAULT_LIFECYCLE_STAGES } from "@/domain/types/manager-progress";

export function getStageLabel(
  slug: string,
  stages: LifecycleStage[] = DEFAULT_LIFECYCLE_STAGES,
): string {
  return stages.find((stage) => stage.slug === slug)?.name ?? slug;
}

export function inferStageFromEvent(eventType: string, currentStage: string): string {
  switch (eventType) {
    case "merge_request_opened":
    case "merge_request_updated":
      return stageAtLeast(currentStage, "code_review") ? currentStage : "code_review";
    case "merge_request_approved":
      return stageAtLeast(currentStage, "code_review") ? currentStage : "code_review";
    case "merge_request_merged":
      return "qa_ready";
    case "issue_opened":
      return stageAtLeast(currentStage, "development") ? currentStage : "development";
    case "issue_closed":
      return "completed";
    case "push_to_branch":
    case "commit":
    case "branch_created":
      return stageAtLeast(currentStage, "development") ? currentStage : "development";
    case "deployment":
      return "production";
    case "release":
      return "release_ready";
    case "pipeline":
      return currentStage;
    default:
      return currentStage;
  }
}

function stageAtLeast(current: string, target: string): boolean {
  const stages = DEFAULT_LIFECYCLE_STAGES;
  const currentOrder = stages.find((s) => s.slug === current)?.order ?? 0;
  const targetOrder = stages.find((s) => s.slug === target)?.order ?? 0;
  return currentOrder >= targetOrder;
}

export function isMeaningfulStageTransition(
  previousStage: string,
  nextStage: string,
  eventType: string,
): boolean {
  if (previousStage === nextStage) {
    return ["merge_request_merged", "merge_request_approved", "issue_closed", "deployment", "release"].includes(eventType);
  }

  const stages = DEFAULT_LIFECYCLE_STAGES;
  const prevOrder = stages.find((s) => s.slug === previousStage)?.order ?? 0;
  const nextOrder = stages.find((s) => s.slug === nextStage)?.order ?? 0;
  return nextOrder > prevOrder || nextStage === "completed";
}

export function classifyWorkFromEvent(
  eventType: string,
  title: string,
  description: string,
): "HOTFIX" | "PRODUCTION_SUPPORT" | "DEFECT" | "ENHANCEMENT" | "PLANNED_FEATURE" | "TECHNICAL_MAINTENANCE" | "UNKNOWN" {
  const text = `${title} ${description}`.toLowerCase();
  if (/\bhotfix\b/.test(text)) return "HOTFIX";
  if (/\bproduction support\b|\bprod support\b|\bincident\b/.test(text)) {
    return "PRODUCTION_SUPPORT";
  }
  if (/\bbug\b|\bdefect\b|\bfix\b/.test(text)) return "DEFECT";
  if (/\brefactor\b|\bmaintenance\b|\btech debt\b/.test(text)) {
    return "TECHNICAL_MAINTENANCE";
  }
  if (/\benhancement\b|\bimprovement\b/.test(text)) return "ENHANCEMENT";
  if (eventType === "issue_opened" || eventType === "merge_request_opened") {
    return "PLANNED_FEATURE";
  }
  return "UNKNOWN";
}

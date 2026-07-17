import type { ManagedOutcomeLabels } from "@/domain/types/sprint-intelligence";
import type { ManagedLabelDefinition } from "@/domain/types/sprint-intelligence-gitlab";
import type { EnsureGitLabLabelInput } from "@/domain/types/gitlab";

export const DEFAULT_MANAGED_LABEL_DEFINITIONS: Record<
  string,
  ManagedLabelDefinition
> = {
  "sprint::planned": {
    color: "#428BCA",
    description: "Issue included in sprint planning",
  },
  "sprint::committed": {
    color: "#1AAA55",
    description: "Planned issue completed within the sprint",
  },
  "sprint::spillover": {
    color: "#D9534F",
    description: "Planned issue not completed within the sprint",
  },
  "sprint::completed-unplanned": {
    color: "#F0AD4E",
    description: "Unplanned issue completed within the sprint",
  },
  unplanned: {
    color: "#A56CC1",
    description: "Issue added after the sprint planning boundary",
  },
};

export function managedLabelsToEnsureInputs(
  managed: ManagedOutcomeLabels,
  definitions: Record<string, ManagedLabelDefinition> = DEFAULT_MANAGED_LABEL_DEFINITIONS,
): EnsureGitLabLabelInput[] {
  const names = [
    managed.planned,
    managed.committed,
    managed.spillover,
    managed.completedUnplanned,
    managed.unplanned,
  ];

  return names.map((name) => {
    const def = definitions[name] ?? {
      color: "#428BCA",
      description: `Sprint intelligence managed label: ${name}`,
    };
    return {
      name,
      color: def.color,
      description: def.description,
    };
  });
}

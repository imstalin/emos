import type { HealthStatus, Priority, WorkItemState } from "@prisma/client";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

import { HEALTH_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  try {
    return isPast(parseISO(iso));
  } catch {
    return false;
  }
}

export function getHealthLabel(health: HealthStatus): string {
  return health.replace("_", " ");
}

export function getHealthClass(health: HealthStatus): string {
  return HEALTH_COLORS[health];
}

export function getPriorityVariant(
  priority: Priority,
): "destructive" | "default" | "secondary" | "outline" {
  switch (priority) {
    case "CRITICAL":
      return "destructive";
    case "HIGH":
      return "default";
    case "MEDIUM":
      return "secondary";
    default:
      return "outline";
  }
}

export function getStateLabel(state: WorkItemState): string {
  return state.replace(/_/g, " ");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function cnHealthDot(health: HealthStatus): string {
  return cn("size-2 rounded-full shrink-0", {
    "bg-emerald-500": health === "HEALTHY",
    "bg-amber-500": health === "AT_RISK",
    "bg-red-500": health === "CRITICAL",
    "bg-muted-foreground": health === "UNKNOWN",
  });
}

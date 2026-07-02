import { z } from "zod";

import {
  ROADMAP_INCLUDE_OPTIONS,
  ROADMAP_PRIORITIES,
  type RoadmapHours,
  type RoadmapItem,
} from "@/domain/types/roadmap";

const hoursSchema = z.union([
  z.literal("TBD"),
  z.number().finite().nonnegative(),
]);

const gitlabLinkSchema = z
  .object({
    projectId: z.number(),
    issueIid: z.number(),
    issueUrl: z.string().url(),
    issueId: z.number(),
    createdAt: z.string(),
  })
  .optional();

export const roadmapItemInputSchema = z.object({
  priority: z.enum(ROADMAP_PRIORITIES as unknown as [string, ...string[]]),
  include: z.enum(ROADMAP_INCLUDE_OPTIONS as unknown as [string, ...string[]]),
  project: z.string().trim().min(1),
  category: z.string().trim().min(1),
  quarter: z.string().trim().min(1),
  timeline: z.string(),
  assignee: z.string(),
  hours: hoursSchema,
  core: z.boolean(),
  mobile: z.boolean(),
  data: z.boolean(),
  title: z.string().trim().min(1),
  description: z.string(),
  gitlab: gitlabLinkSchema,
  hoursSpent: z.number().nonnegative().optional(),
});

export const roadmapItemWithIdSchema = roadmapItemInputSchema.extend({
  id: z.string().min(1),
});

export type RoadmapItemInput = z.infer<typeof roadmapItemInputSchema>;

export function toRoadmapItemInput(item: RoadmapItemInput): Omit<RoadmapItem, "id"> {
  return {
    ...item,
    priority: item.priority as RoadmapItem["priority"],
    include: item.include as RoadmapItem["include"],
    hours: item.hours as RoadmapHours,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";

import type { ManagerProgressFilters } from "@/domain/types/manager-progress";
import {
  fetchFeedHealth,
  fetchManagerProgressDashboard,
} from "@/features/manager-progress/api/manager-progress-client";

export function useManagerProgress(filters: ManagerProgressFilters = {}) {
  return useQuery({
    queryKey: ["manager-progress", filters],
    queryFn: () => fetchManagerProgressDashboard(filters),
    staleTime: 60_000,
  });
}

export function useFeedHealth() {
  return useQuery({
    queryKey: ["feed-health"],
    queryFn: fetchFeedHealth,
    staleTime: 60_000,
  });
}

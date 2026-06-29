import type { PhoenixKpiRow } from "@/domain/types/phoenix-kpi";

export function computeYtdScore(row: PhoenixKpiRow): number | null {
  const scores = row.monthly
    .map((month) => month.score)
    .filter((score): score is number => score !== null && Number.isFinite(score));

  if (scores.length === 0) return null;
  const sum = scores.reduce((total, score) => total + score, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

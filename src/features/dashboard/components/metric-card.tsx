import type { HealthStatus } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cnHealthDot, getHealthClass, getHealthLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  health?: HealthStatus;
  trend?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  health,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="line-clamp-1">{title}</CardDescription>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </div>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {(description || health || trend) && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {health ? (
              <span className={cn("inline-flex items-center gap-1.5", getHealthClass(health))}>
                <span className={cnHealthDot(health)} />
                {getHealthLabel(health)}
              </span>
            ) : null}
            {description ? <span>{description}</span> : null}
            {trend ? <Badge variant="secondary">{trend}</Badge> : null}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  badge,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
          {badge}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

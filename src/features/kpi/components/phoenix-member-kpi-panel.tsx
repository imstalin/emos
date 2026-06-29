"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PhoenixMemberKpiReport } from "@/domain/types/phoenix-kpi";
import { PhoenixMemberKpiTable } from "@/features/kpi/components/phoenix-member-kpi-table";

interface PhoenixMemberKpiPanelProps {
  report: PhoenixMemberKpiReport;
}

export function PhoenixMemberKpiPanel({ report }: PhoenixMemberKpiPanelProps) {
  const [selectedMemberId, setSelectedMemberId] = useState(
    report.members[0]?.memberId ?? "",
  );

  const selectedMember = useMemo(
    () => report.members.find((member) => member.memberId === selectedMemberId),
    [report.members, selectedMemberId],
  );

  if (report.members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active team members found. Add members in seed data or link GitLab
        users to calculate per-person KPIs.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">By team member</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly scores from GitLab activity attributed via assignee and
          reviewer. Select a member to view their KPI breakdown. Team tab scores
          aggregate everyone together.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {report.members.map((member) => (
          <button
            key={member.memberId}
            type="button"
            onClick={() => setSelectedMemberId(member.memberId)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              member.memberId === selectedMemberId
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="font-medium">{member.name}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {member.role}
              {member.gitlabHandle ? ` · @${member.gitlabHandle}` : ""}
            </span>
          </button>
        ))}
      </div>

      {selectedMember ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="font-semibold">{selectedMember.name}</span>
              <Badge variant="secondary">{selectedMember.role}</Badge>
              <Badge variant="outline">
                {selectedMember.capacityWeekly}h / week capacity
              </Badge>
            </div>
            <PhoenixMemberKpiTable
              member={selectedMember}
              months={report.months}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

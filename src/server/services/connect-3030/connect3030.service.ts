import type { Connect3030Status, Prisma } from "@prisma/client";

import type {
  Connect3030AutoBrief,
  Connect3030Dashboard,
  Connect3030Responses,
  Connect3030Session,
} from "@/domain/types/connect-3030";
import {
  EMPTY_CONNECT_RESPONSES,
  monthKeyFromDate,
  monthLabelFromKey,
  responsesFromBrief,
} from "@/domain/types/connect-3030";
import { checkDatabaseConnection, db } from "@/lib/db";

import { buildConnect3030Brief } from "./connect3030-brief.service";

function parseBrief(value: Prisma.JsonValue): Connect3030AutoBrief {
  return value as Connect3030AutoBrief;
}

function parseResponses(value: Prisma.JsonValue): Connect3030Responses {
  const parsed = value as Partial<Connect3030Responses>;
  return {
    ...EMPTY_CONNECT_RESPONSES,
    ...parsed,
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
  };
}

function toSession(record: {
  id: string;
  memberId: string;
  monthKey: string;
  status: Connect3030Status;
  scheduledAt: Date | null;
  completedAt: Date | null;
  autoBrief: Prisma.JsonValue;
  responses: Prisma.JsonValue;
  updatedAt: Date;
  member: {
    name: string;
    role: string;
    gitlabHandle: string | null;
  };
}): Connect3030Session {
  return {
    id: record.id,
    memberId: record.memberId,
    memberName: record.member.name,
    memberRole: record.member.role,
    gitlabHandle: record.member.gitlabHandle,
    monthKey: record.monthKey,
    monthLabel: monthLabelFromKey(record.monthKey),
    status: record.status,
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    autoBrief: parseBrief(record.autoBrief),
    responses: parseResponses(record.responses),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function getDemoDashboard(monthKey: string): Promise<Connect3030Dashboard> {
  return {
    generatedAt: new Date().toISOString(),
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    summary: {
      total: 0,
      pending: 0,
      scheduled: 0,
      completed: 0,
      skipped: 0,
    },
    sessions: [],
  };
}

export const connect3030Service = {
  async getDashboard(monthKey = monthKeyFromDate(new Date())): Promise<Connect3030Dashboard> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return getDemoDashboard(monthKey);
    }

    const members = await db.teamMember.findMany({
      where: { isActive: true, role: { not: "MANAGER" } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    const existing = await db.connect3030Session.findMany({
      where: { monthKey },
      include: {
        member: {
          select: { name: true, role: true, gitlabHandle: true },
        },
      },
    });

    const existingByMember = new Map(existing.map((row) => [row.memberId, row]));
    const sessions: Connect3030Session[] = [];

    for (const member of members) {
      const record = existingByMember.get(member.id);
      if (record) {
        sessions.push(toSession(record));
        continue;
      }

      const brief = await buildConnect3030Brief(member.id, monthKey);
      const upserted = await db.connect3030Session.upsert({
        where: {
          memberId_monthKey: {
            memberId: member.id,
            monthKey,
          },
        },
        create: {
          memberId: member.id,
          monthKey,
          autoBrief: brief as unknown as Prisma.InputJsonValue,
          responses: responsesFromBrief(brief) as unknown as Prisma.InputJsonValue,
        },
        update: {},
        include: {
          member: {
            select: { name: true, role: true, gitlabHandle: true },
          },
        },
      });
      sessions.push(toSession(upserted));
    }

    return {
      generatedAt: new Date().toISOString(),
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      summary: {
        total: sessions.length,
        pending: sessions.filter((s) => s.status === "PENDING").length,
        scheduled: sessions.filter((s) => s.status === "SCHEDULED").length,
        completed: sessions.filter((s) => s.status === "COMPLETED").length,
        skipped: sessions.filter((s) => s.status === "SKIPPED").length,
      },
      sessions,
    };
  },

  async refreshBriefs(monthKey = monthKeyFromDate(new Date())): Promise<Connect3030Dashboard> {
    const connected = await checkDatabaseConnection();
    if (!connected) {
      return getDemoDashboard(monthKey);
    }

    const sessions = await db.connect3030Session.findMany({
      where: { monthKey },
      select: { id: true, memberId: true, status: true, responses: true },
    });

    for (const session of sessions) {
      if (session.status === "COMPLETED") continue;

      const brief = await buildConnect3030Brief(session.memberId, monthKey);
      const currentResponses = parseResponses(session.responses);
      const hasManualEdits =
        currentResponses.memberCommitments.trim() ||
        currentResponses.memberFeedback.trim() ||
        currentResponses.managerSupport.trim();

      await db.connect3030Session.update({
        where: { id: session.id },
        data: {
          autoBrief: brief as unknown as Prisma.InputJsonValue,
          responses: hasManualEdits
            ? ({
                ...responsesFromBrief(brief),
                memberCommitments: currentResponses.memberCommitments,
                memberFeedback: currentResponses.memberFeedback,
                managerSupport: currentResponses.managerSupport,
                actionItems: currentResponses.actionItems.length
                  ? currentResponses.actionItems
                  : responsesFromBrief(brief).actionItems,
              } as unknown as Prisma.InputJsonValue)
            : (responsesFromBrief(brief) as unknown as Prisma.InputJsonValue),
        },
      });
    }

    return this.getDashboard(monthKey);
  },

  async updateSession(
    sessionId: string,
    data: {
      status?: Connect3030Status;
      scheduledAt?: string | null;
      responses?: Connect3030Responses;
      autofillFromBrief?: boolean;
    },
  ): Promise<Connect3030Session> {
    const existing = await db.connect3030Session.findUnique({
      where: { id: sessionId },
      include: {
        member: {
          select: { name: true, role: true, gitlabHandle: true },
        },
      },
    });

    if (!existing) {
      throw new Error("Session not found");
    }

    const brief = parseBrief(existing.autoBrief);
    let responses = parseResponses(existing.responses);

    if (data.autofillFromBrief) {
      responses = {
        ...responsesFromBrief(brief),
        memberCommitments: responses.memberCommitments,
        memberFeedback: responses.memberFeedback,
        managerSupport: responses.managerSupport,
      };
    }

    if (data.responses) {
      responses = data.responses;
    }

    const updated = await db.connect3030Session.update({
      where: { id: sessionId },
      data: {
        status: data.status,
        scheduledAt:
          data.scheduledAt === undefined
            ? undefined
            : data.scheduledAt
              ? new Date(data.scheduledAt)
              : null,
        completedAt: data.status === "COMPLETED" ? new Date() : undefined,
        responses: responses as unknown as Prisma.InputJsonValue,
      },
      include: {
        member: {
          select: { name: true, role: true, gitlabHandle: true },
        },
      },
    });

    return toSession(updated);
  },
};

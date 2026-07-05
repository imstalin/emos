import type {
  ImpactRisk,
  TestAutomation,
} from "@/domain/types/impact-matrix";

export interface RepoFlowMapping {
  category: string;
  flows: string[];
  risk: ImpactRisk;
  testSuites: string[];
  automation: TestAutomation;
}

const DEFAULT_MAPPING: RepoFlowMapping = {
  category: "platform",
  flows: ["General platform"],
  risk: "medium",
  testSuites: ["PLATFORM-SMOKE"],
  automation: "mixed",
};

export const PHOENIX_REPO_FLOW_MAP: Record<string, RepoFlowMapping> = {
  identity: {
    category: "services",
    flows: ["Authentication & SSO", "Tenant management"],
    risk: "high",
    testSuites: ["AUTH-SUITE", "SSO-SUITE", "TENANT-ACCESS"],
    automation: "automated",
  },
  tenant: {
    category: "services",
    flows: ["Tenant management", "Authentication & SSO"],
    risk: "high",
    testSuites: ["TENANT-SUITE", "TENANT-ISOLATION"],
    automation: "automated",
  },
  "api-proxy": {
    category: "services",
    flows: ["API gateway & routing", "Authentication & SSO"],
    risk: "high",
    testSuites: ["API-GW-SUITE", "ROUTING-SUITE"],
    automation: "automated",
  },
  otp: {
    category: "services",
    flows: ["OTP & verification", "Authentication & SSO"],
    risk: "high",
    testSuites: ["OTP-SUITE"],
    automation: "automated",
  },
  business: {
    category: "services",
    flows: ["Business rules & CQ", "Workflow execution"],
    risk: "high",
    testSuites: ["BUSINESS-RULES-SUITE"],
    automation: "mixed",
  },
  "cq-engine": {
    category: "services",
    flows: ["Business rules & CQ"],
    risk: "medium",
    testSuites: ["CQ-ENGINE-SUITE"],
    automation: "automated",
  },
  "meta-data": {
    category: "services",
    flows: ["Business rules & CQ", "Content management"],
    risk: "medium",
    testSuites: ["METADATA-SUITE"],
    automation: "automated",
  },
  cms: {
    category: "services",
    flows: ["Content management", "Learner experience"],
    risk: "medium",
    testSuites: ["CMS-SUITE", "CONTENT-PUBLISH"],
    automation: "mixed",
  },
  geneeapi: {
    category: "services",
    flows: ["Platform API", "API gateway & routing"],
    risk: "high",
    testSuites: ["GENEEAPI-SUITE"],
    automation: "automated",
  },
  logging: {
    category: "services",
    flows: ["Observability & logging"],
    risk: "low",
    testSuites: ["LOGGING-SMOKE"],
    automation: "automated",
  },
  lxp: {
    category: "services",
    flows: ["Learner experience", "Content management"],
    risk: "high",
    testSuites: ["LXP-E2E"],
    automation: "mixed",
  },
  "flow-engine": {
    category: "workers",
    flows: ["Workflow execution", "Event processing & notifications"],
    risk: "high",
    testSuites: ["FLOW-ENGINE-E2E", "FLOW-EXECUTION"],
    automation: "automated",
  },
  "flow-triggers": {
    category: "workers",
    flows: ["Workflow execution"],
    risk: "high",
    testSuites: ["FLOW-TRIGGER-SUITE"],
    automation: "automated",
  },
  "business-tasks": {
    category: "workers",
    flows: ["Workflow execution", "Business rules & CQ"],
    risk: "high",
    testSuites: ["BUSINESS-TASKS-SUITE"],
    automation: "mixed",
  },
  "event-engine": {
    category: "workers",
    flows: ["Event processing & notifications"],
    risk: "medium",
    testSuites: ["EVENT-ENGINE-SUITE"],
    automation: "automated",
  },
  notify: {
    category: "workers",
    flows: ["Event processing & notifications"],
    risk: "medium",
    testSuites: ["NOTIFY-SUITE", "EMAIL-PUSH"],
    automation: "automated",
  },
  banks: {
    category: "workers",
    flows: ["Banking integrations"],
    risk: "high",
    testSuites: ["BANKS-SUITE"],
    automation: "manual",
  },
  geneeworker: {
    category: "workers",
    flows: ["Workflow execution", "Platform API"],
    risk: "medium",
    testSuites: ["GENEE-WORKER-SUITE"],
    automation: "automated",
  },
  admin: {
    category: "controlpanel",
    flows: ["Control panel admin", "Tenant management"],
    risk: "medium",
    testSuites: ["CP-ADMIN-SUITE", "CP-SMOKE"],
    automation: "manual",
  },
  geneeadmin: {
    category: "controlpanel",
    flows: ["Control panel admin"],
    risk: "medium",
    testSuites: ["GENEE-ADMIN-SUITE"],
    automation: "manual",
  },
  inventory: {
    category: "controlpanel",
    flows: ["Inventory management", "Control panel admin"],
    risk: "medium",
    testSuites: ["INVENTORY-SUITE"],
    automation: "mixed",
  },
  webapp: {
    category: "frontend",
    flows: ["Learner experience", "Authentication & SSO"],
    risk: "high",
    testSuites: ["WEBAPP-E2E", "LEARNER-FLOWS"],
    automation: "automated",
  },
};

export function lookupRepoFlowMapping(projectName: string): {
  mapping: RepoFlowMapping;
  mapped: boolean;
} {
  const key = projectName.trim().toLowerCase();
  const mapping = PHOENIX_REPO_FLOW_MAP[key];
  if (mapping) {
    return { mapping, mapped: true };
  }
  return { mapping: DEFAULT_MAPPING, mapped: false };
}

export function inferCategoryFromGroupId(groupId: string): string {
  const normalized = groupId.toLowerCase();
  if (normalized.includes("/workers") || normalized.endsWith("workers")) {
    return "workers";
  }
  if (normalized.includes("/services") || normalized.endsWith("services")) {
    return "services";
  }
  if (normalized.includes("controlpanel")) return "controlpanel";
  if (normalized.includes("/frontend") || normalized.endsWith("frontend")) {
    return "frontend";
  }
  return "platform";
}

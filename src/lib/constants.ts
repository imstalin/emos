export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Engineering Manager OS";

export const NAV_ITEMS = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: "LayoutDashboard" },
      { title: "Team Dashboard", href: "/team", icon: "Users" },
      { title: "30:30 Connect", href: "/connect-3030", icon: "MessageSquare" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { title: "Product Backlog", href: "/product-backlog", icon: "ClipboardList" },
      { title: "FY Planning", href: "/planning", icon: "CalendarRange" },
      { title: "Phoenix KPI", href: "/kpi/phoenix", icon: "BarChart3" },
      { title: "GitLab Activity", href: "/gitlab", icon: "GitBranch" },
      { title: "Release Management", href: "/releases", icon: "Rocket" },
      { title: "Follow-ups", href: "/follow-ups", icon: "Bell" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { title: "AI Assistant", href: "/assistant", icon: "Sparkles" },
      { title: "Timesheets", href: "/timesheets", icon: "Clock" },
      { title: "Governance", href: "/governance", icon: "Shield" },
    ],
  },
  {
    title: "System",
    items: [{ title: "Settings", href: "/settings", icon: "Settings" }],
  },
] as const;

export const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const HEALTH_COLORS = {
  HEALTHY: "text-emerald-600 dark:text-emerald-400",
  AT_RISK: "text-amber-600 dark:text-amber-400",
  CRITICAL: "text-red-600 dark:text-red-400",
  UNKNOWN: "text-muted-foreground",
} as const;

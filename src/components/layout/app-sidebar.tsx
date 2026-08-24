"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarRange,
  ClipboardList,
  Clock,
  Gauge,
  GitBranch,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Mail,
  Map,
  MessageSquare,
  MessageSquareText,
  MessageSquareWarning,
  Rocket,
  ShieldCheck,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Megaphone,
  Map,
  Users,
  MessageSquare,
  MessageSquareText,
  MessageSquareWarning,
  Gauge,
  ClipboardList,
  CalendarRange,
  KanbanSquare,
  BarChart3,
  GitBranch,
  Rocket,
  ShieldCheck,
  Bell,
  Sparkles,
  Clock,
  Shield,
  Settings,
  TrendingUp,
};

const ALL_NAV_HREFS = NAV_ITEMS.flatMap((group) =>
  group.items.map((item) => item.href),
);

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayoutDashboard className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{APP_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Engineering Manager
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_ITEMS.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                  const matches =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                  const hasMoreSpecificMatch = ALL_NAV_HREFS.some(
                    (href) =>
                      href !== item.href &&
                      href.length > item.href.length &&
                      href.startsWith(`${item.href}/`) &&
                      (pathname === href || pathname.startsWith(`${href}/`)),
                  );
                  const isActive = matches && !hasMoreSpecificMatch;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Phase 2</p>
          <p>GitLab Integration</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          "bg-muted text-muted-foreground",
        )}
      >
        <Sparkles className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <p className="text-xs text-muted-foreground">Coming in a future phase</p>
    </div>
  );
}

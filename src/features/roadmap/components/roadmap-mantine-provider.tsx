"use client";

import { useEffect } from "react";
import { MantineProvider, createTheme } from "@mantine/core";

import { useTheme } from "@/components/providers/theme-provider";

import "@mantine/core/styles.css";

const roadmapTheme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
});

interface RoadmapMantineProviderProps {
  children: React.ReactNode;
}

export function RoadmapMantineProvider({ children }: RoadmapMantineProviderProps) {
  const { resolvedTheme } = useTheme();
  const colorScheme = resolvedTheme ?? "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  }, [colorScheme]);

  return (
    <MantineProvider theme={roadmapTheme} forceColorScheme={colorScheme}>
      {children}
    </MantineProvider>
  );
}

"use client";

import {
  Globe,
  BarChart2,
  Code,
  Users,
  MessageCircleDashed,
  ClockIcon,
} from "lucide-react";
import type { TeamTabMode } from "@/app/store";

export type RightPanelTabConfig = {
  id: "tempchat" | "history" | "team" | "web" | "code" | "chart";
  title: string;
  icon: typeof Users;
  defaultMode?: TeamTabMode;
  getInitialContent: () => any;
};

export const RIGHT_PANEL_TAB_CONFIGS: RightPanelTabConfig[] = [
  {
    id: "tempchat",
    title: "Temporary chat",
    icon: MessageCircleDashed,
    getInitialContent: () => ({}),
  },
  {
    id: "history",
    title: "Recent chats",
    icon: ClockIcon,
    getInitialContent: () => ({}),
  },
  {
    id: "team",
    title: "Team chat",
    icon: Users,
    defaultMode: "comparison",
    getInitialContent: () => ({ agents: [], status: undefined }),
  },
  {
    id: "web",
    title: "Web",
    icon: Globe,
    getInitialContent: () => ({ url: "" }),
  },
  {
    id: "code",
    title: "Code",
    icon: Code,
    getInitialContent: () => ({ code: "" }),
  },
  {
    id: "chart",
    title: "Chart",
    icon: BarChart2,
    getInitialContent: () => ({ data: [] }),
  },
];

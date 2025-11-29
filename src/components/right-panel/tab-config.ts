"use client";

import {
  Globe,
  BarChart2,
  Code,
  Users,
  MessageCircleDashed,
  ClockIcon,
  Speech,
} from "lucide-react";
import type { TeamTabMode } from "@/app/store";

export type RightPanelTabConfig = {
  id: "tempchat" | "history" | "team" | "web" | "code" | "chart" | "voice";
  title: string;
  icon: typeof Users;
  defaultMode?: TeamTabMode;
  getInitialContent: () => any;
};

export const RIGHT_PANEL_TAB_CONFIGS: RightPanelTabConfig[] = [
  {
    id: "history",
    title: "Recent chats",
    icon: ClockIcon,
    getInitialContent: () => ({}),
  },
  {
    id: "tempchat",
    title: "Temporary chat",
    icon: MessageCircleDashed,
    getInitialContent: () => ({}),
  },
  {
    id: "voice",
    title: "Voice Chat",
    icon: Speech,
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
    title: "Web view",
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

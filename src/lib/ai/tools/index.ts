export enum AppDefaultToolkit {
  Visualization = "visualization",
  WebSearch = "webSearch",
  Http = "http",
  Code = "code",
  PageAgent = "pageAgent",
}

export enum DefaultToolName {
  CreatePieChart = "createPieChart",
  CreateBarChart = "createBarChart",
  CreateLineChart = "createLineChart",
  CreateTable = "createTable",
  WebSearch = "webSearch",
  WebContent = "webContent",
  Http = "http",
  JavascriptExecution = "js-execution",
  PythonExecution = "python-execution",
  PageAgent = "page-agent",
}

export const SequentialThinkingToolName = "sequential-thinking";

export const ImageToolName = "image-manager";

// tool registry
import type { ComponentType } from "react";
import {
  ChartPieIcon,
  ChartColumnIcon,
  TrendingUpIcon,
  TableOfContents,
  GlobeIcon,
  HardDriveUploadIcon,
  CodeIcon,
  MousePointer,
  ChartColumn,
  Search,
  Code as CodeIcon2,
  LinkIcon,
} from "lucide-react";

export interface BuiltinToolInfo {
  name: DefaultToolName;
  label: string;
  description: string;
  category: BuiltinToolCategory;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

export type BuiltinToolCategory =
  | "visualization"
  | "web"
  | "code"
  | "http"
  | "page-agent";

export const BUILTIN_TOOL_REGISTRY = {
  [DefaultToolName.CreatePieChart]: {
    name: DefaultToolName.CreatePieChart,
    label: "pie-chart",
    description: "Create a pie chart",
    category: "visualization",
    icon: ChartPieIcon,
    color: "blue-500",
  },
  [DefaultToolName.CreateBarChart]: {
    name: DefaultToolName.CreateBarChart,
    label: "bar-chart",
    description: "Create a bar chart",
    category: "visualization",
    icon: ChartColumnIcon,
    color: "blue-500",
  },
  [DefaultToolName.CreateLineChart]: {
    name: DefaultToolName.CreateLineChart,
    label: "line-chart",
    description: "Create a line chart",
    category: "visualization",
    icon: TrendingUpIcon,
    color: "blue-500",
  },
  [DefaultToolName.CreateTable]: {
    name: DefaultToolName.CreateTable,
    label: "table",
    description: "Create a table",
    category: "visualization",
    icon: TableOfContents,
    color: "blue-500",
  },
  [DefaultToolName.WebSearch]: {
    name: DefaultToolName.WebSearch,
    label: "web-search",
    description: "Search the web",
    category: "web",
    icon: GlobeIcon,
    color: "blue-400",
  },
  [DefaultToolName.WebContent]: {
    name: DefaultToolName.WebContent,
    label: "web-content",
    description: "Get the content of a web page",
    category: "web",
    icon: GlobeIcon,
    color: "blue-400",
  },
  [DefaultToolName.Http]: {
    name: DefaultToolName.Http,
    label: "http",
    description: "Send an http request",
    category: "http",
    icon: HardDriveUploadIcon,
    color: "blue-300",
  },
  [DefaultToolName.JavascriptExecution]: {
    name: DefaultToolName.JavascriptExecution,
    label: "js-execution",
    description: "Execute javascript code",
    category: "code",
    icon: CodeIcon,
    color: "yellow-400",
  },
  [DefaultToolName.PythonExecution]: {
    name: DefaultToolName.PythonExecution,
    label: "python-execution",
    description: "Execute python code",
    category: "code",
    icon: CodeIcon,
    color: "blue-400",
  },
  [DefaultToolName.PageAgent]: {
    name: DefaultToolName.PageAgent,
    label: "page-agent",
    description: "Control web page with AI",
    category: "page-agent",
    icon: MousePointer,
    color: "green-500",
  },
} as const;

export type BuiltinToolInfoType =
  (typeof BUILTIN_TOOL_REGISTRY)[DefaultToolName];

// Helper functions
export function getBuiltinToolInfo(
  toolName: DefaultToolName,
): BuiltinToolInfoType {
  return BUILTIN_TOOL_REGISTRY[toolName];
}

export function getAllBuiltinTools(): BuiltinToolInfoType[] {
  return Object.values(BUILTIN_TOOL_REGISTRY);
}

export function getBuiltinToolsByCategory(
  category: BuiltinToolCategory,
): BuiltinToolInfoType[] {
  return Object.values(BUILTIN_TOOL_REGISTRY).filter(
    (tool) => tool.category === category,
  );
}

export function getBuiltinToolCategories(): BuiltinToolCategory[] {
  return ["visualization", "web", "code", "http", "page-agent"];
}

// AppDefaultToolkit configuration for tool-select-dropdown
export interface ToolkitInfo {
  id: AppDefaultToolkit;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const TOOLKIT_CONFIG: Record<AppDefaultToolkit, ToolkitInfo> = {
  [AppDefaultToolkit.Visualization]: {
    id: AppDefaultToolkit.Visualization,
    label: "visualization",
    icon: ChartColumn,
  },
  [AppDefaultToolkit.WebSearch]: {
    id: AppDefaultToolkit.WebSearch,
    label: "webSearch",
    icon: Search,
  },
  [AppDefaultToolkit.Code]: {
    id: AppDefaultToolkit.Code,
    label: "code",
    icon: CodeIcon2,
  },
  [AppDefaultToolkit.Http]: {
    id: AppDefaultToolkit.Http,
    label: "http",
    icon: LinkIcon,
  },
  [AppDefaultToolkit.PageAgent]: {
    id: AppDefaultToolkit.PageAgent,
    label: "pageAgent",
    icon: MousePointer,
  },
} as const;

export type ToolkitInfoType = (typeof TOOLKIT_CONFIG)[AppDefaultToolkit];

export function getToolkitInfo(toolkit: AppDefaultToolkit): ToolkitInfoType {
  return TOOLKIT_CONFIG[toolkit];
}

export function getAllToolkitInfos(): ToolkitInfoType[] {
  return Object.values(TOOLKIT_CONFIG);
}

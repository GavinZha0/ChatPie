"use client";

import { useCallback, useMemo, useState } from "react";
import { ChatMention } from "app-types/chat";
import { DefaultToolName, getAllBuiltinTools } from "lib/ai/tools";
import { cn } from "lib/utils";
import equal from "lib/equal";
import { Loader, HammerIcon, Check, SearchIcon } from "lucide-react";
import { DefaultToolIcon } from "@/components/default-tool-icon";
import { MCPIcon } from "ui/mcp-icon";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { getEmojiUrl } from "lib/emoji";
import { Input } from "ui/input";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "ui/tabs";
import { useTranslations } from "next-intl";

interface AgentToolsTabProps {
  agent: any;
  setAgent: (updates: Partial<any>) => void;
  isLoadingTool: boolean;
  isLoading: boolean;
  hasEditAccess: boolean;
  isSelectedModelAgentType: boolean;
}

interface ToolItem {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  mention: ChatMention;
  children?: ToolItem[]; // For MCP server tools
  isExpanded?: boolean; // For tree expansion state
}

// Tool list component for reuse
function ToolList({
  tools,
  onToggleTool,
  hasEditAccess,
  onToggleExpand,
  isToolSelected,
}: {
  tools: ToolItem[];
  selectedIds: string[];
  onToggleTool: (tool: ToolItem) => void;
  hasEditAccess: boolean;
  onToggleExpand?: (toolId: string) => void;
  isToolSelected: (tool: ToolItem) => boolean;
}) {
  const t = useTranslations("MCP");

  if (tools.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {t("noToolsAvailable")}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-[350px]">
      <div className="space-y-1 p-1">
        {tools.map((tool) => {
          const isSelected = isToolSelected(tool);
          const hasChildren = tool.children && tool.children.length > 0;

          return (
            <div key={tool.id}>
              {/* Server or top-level tool */}
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-secondary",
                )}
                onClick={() => hasEditAccess && onToggleTool(tool)}
              >
                {hasChildren && (
                  <button
                    className="shrink-0 p-1 hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Extract the actual server ID from the tool.id JSON string
                      const serverMention = JSON.parse(tool.id);
                      onToggleExpand?.(serverMention.serverId);
                    }}
                  >
                    <svg
                      className={cn(
                        "size-4 transition-transform",
                        tool.isExpanded ? "rotate-90" : "",
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
                <div className="shrink-0">{tool.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{tool.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </div>
                </div>
                {isSelected && <Check className="size-4 text-primary" />}
              </div>

              {/* Child tools (expanded state) */}
              {hasChildren && tool.isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {tool.children?.map((childTool) => {
                    const isChildSelected = isToolSelected(childTool);
                    return (
                      <div
                        key={childTool.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border-l-2 border-muted",
                          isChildSelected
                            ? "bg-accent/50 text-accent-foreground border-accent-foreground"
                            : "hover:bg-secondary",
                        )}
                        onClick={() => hasEditAccess && onToggleTool(childTool)}
                      >
                        <div className="shrink-0">{childTool.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {childTool.label}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {childTool.description}
                          </div>
                        </div>
                        {isChildSelected && (
                          <Check className="size-4 text-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentToolsTab({
  agent,
  setAgent,
  isLoadingTool,
  hasEditAccess,
}: AgentToolsTabProps) {
  const t = useTranslations("MCP");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set(),
  );

  const mentions = agent.tools || [];
  const [mcpList, workflowList] = appStore(
    useShallow((state) => [state.mcpList, state.workflowToolList]),
  );

  const selectedIds = useMemo(() => {
    return mentions.map((m) => JSON.stringify(m));
  }, [mentions]);

  // Create a proper comparison function for MCP tools
  const isToolSelected = useCallback(
    (tool: ToolItem) => {
      return mentions.some((mention) => equal(mention, tool.mention));
    },
    [mentions],
  );

  const handleToggleExpand = useCallback((serverId: string) => {
    setExpandedServers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serverId)) {
        newSet.delete(serverId);
      } else {
        newSet.add(serverId);
      }
      return newSet;
    });
  }, []);

  // Generate tool items grouped by type
  const { mcpTools, workflowTools, defaultTools } = useMemo(() => {
    const mcpItems: ToolItem[] = [];
    const workflowItems: ToolItem[] = [];
    const defaultItems: ToolItem[] = [];

    // MCP Tools - Create tree structure
    const filteredMcp =
      mcpList
        ?.filter((mcp) => mcp.toolInfo?.length)
        .filter((mcp) => {
          if (!searchQuery) return true;
          const search = searchQuery.toLowerCase();
          return (
            mcp.name.toLowerCase().includes(search) ||
            mcp.toolInfo?.some((tool) =>
              tool.name.toLowerCase().includes(search),
            )
          );
        }) || [];

    filteredMcp.forEach((mcp) => {
      // Create server mention
      const serverMention: ChatMention = {
        type: "mcpServer",
        name: mcp.name,
        serverId: mcp.id,
        description: `${mcp.toolInfo?.length ?? 0} tools.`,
        toolCount: mcp.toolInfo?.length ?? 0,
      };

      // Create child tool mentions
      const childTools: ToolItem[] = (mcp.toolInfo || []).map((tool) => {
        const toolMention: ChatMention = {
          type: "mcpTool",
          name: tool.name,
          serverId: mcp.id,
          description: tool.description || `Tool from ${mcp.name}`,
        };

        return {
          id: JSON.stringify(toolMention),
          type: "mcpTool",
          label: tool.name,
          description: tool.description || `Tool from ${mcp.name}`,
          icon: <MCPIcon className="size-3" />,
          mention: toolMention,
        };
      });

      // Filter child tools based on search
      const filteredChildTools = searchQuery
        ? childTools.filter(
            (tool) =>
              tool.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tool.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase()),
          )
        : childTools;

      mcpItems.push({
        id: JSON.stringify(serverMention),
        type: "mcpServer",
        label: mcp.name,
        description: `${mcp.toolInfo?.length ?? 0} tools`,
        icon: <MCPIcon className="size-4" />,
        mention: serverMention,
        children: filteredChildTools,
        isExpanded: expandedServers.has(mcp.id),
      });
    });

    // Workflow Tools
    const filteredWorkflows =
      workflowList?.filter((workflow) => {
        if (!searchQuery) return true;
        return workflow.name.toLowerCase().includes(searchQuery.toLowerCase());
      }) || [];

    filteredWorkflows.forEach((workflow) => {
      const mention: ChatMention = {
        type: "workflow",
        name: workflow.name,
        workflowId: workflow.id,
        description: workflow.description || "",
        icon: workflow.icon,
      };

      workflowItems.push({
        id: JSON.stringify(mention),
        type: "workflow",
        label: workflow.name,
        description: workflow.description || "Workflow tool",
        icon: (
          <Avatar
            style={workflow.icon?.style}
            className="size-4 ring-[1px] ring-input rounded-full"
          >
            <AvatarImage
              src={
                workflow.icon?.value
                  ? getEmojiUrl(workflow.icon.value, "apple", 64)
                  : undefined
              }
            />
            <AvatarFallback>{workflow.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        ),
        mention,
      });
    });

    // Default Tools
    const defaultToolItems = getAllBuiltinTools()
      .filter((toolInfo) => {
        if (!searchQuery) return true;
        return (
          toolInfo.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          toolInfo.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
      .map((toolInfo) => {
        const mention: ChatMention = {
          type: "defaultTool",
          name: toolInfo.name,
          label: toolInfo.label,
          description: toolInfo.description,
        };

        return {
          id: JSON.stringify(mention),
          type: "defaultTool",
          label: toolInfo.label,
          description: toolInfo.description,
          icon: <DefaultToolIcon name={toolInfo.name} className="size-4" />,
          mention,
        };
      });

    defaultItems.push(...defaultToolItems);

    return {
      mcpTools: mcpItems,
      workflowTools: workflowItems,
      defaultTools: defaultItems,
    };
  }, [mcpList, workflowList, searchQuery, expandedServers]);

  const handleToggleTool = useCallback(
    (tool: ToolItem) => {
      const newMentions = [...mentions];
      const index = newMentions.findIndex((m) => equal(m, tool.mention));

      if (index !== -1) {
        // Remove the tool
        newMentions.splice(index, 1);
      } else {
        // Add the tool
        newMentions.push(tool.mention);

        // If selecting an MCP server, remove all its individual tools
        if (tool.type === "mcpServer" && tool.children) {
          const serverId = (tool.mention as any).serverId;
          newMentions.splice(
            0,
            newMentions.length,
            ...newMentions.filter((mention) => {
              // Keep mentions that are NOT individual tools from this server
              return !(
                mention.type === "mcpTool" &&
                (mention as any).serverId === serverId
              );
            }),
          );
        }

        // If selecting an individual MCP tool, remove the server selection if it exists
        if (tool.type === "mcpTool") {
          const serverId = (tool.mention as any).serverId;
          newMentions.splice(
            0,
            newMentions.length,
            ...newMentions.filter((mention) => {
              // Keep mentions that are NOT the server for this tool
              return !(
                mention.type === "mcpServer" &&
                (mention as any).serverId === serverId
              );
            }),
          );
        }
      }

      setAgent({ tools: newMentions });
    },
    [mentions, setAgent],
  );

  const selectedMentions = useMemo(() => {
    return mentions.map((m, i) => (
      <div
        key={i}
        className={cn(
          "text-xs flex items-center gap-1 px-2 py-1 rounded-sm bg-background border",
          hasEditAccess &&
            "hover:ring hover:ring-destructive group cursor-pointer",
        )}
        onClick={() => {
          if (hasEditAccess) {
            setAgent({
              tools: mentions.filter((mention) => !equal(mention, m)),
            });
          }
        }}
      >
        <div className="p-0.5">
          {m.type === "defaultTool" ? (
            <DefaultToolIcon
              name={m.name as DefaultToolName}
              className="size-3"
            />
          ) : m.type === "mcpServer" ? (
            <MCPIcon className="size-3" />
          ) : m.type === "mcpTool" ? (
            <MCPIcon className="size-3" />
          ) : m.type === "workflow" ? (
            <Avatar
              style={m.icon?.style}
              className="size-3 ring-[1px] ring-input rounded-full"
            >
              <AvatarImage
                src={
                  m.icon?.value
                    ? getEmojiUrl(m.icon.value, "apple", 64)
                    : undefined
                }
              />
              <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
          ) : (
            <HammerIcon className="size-3" />
          )}
        </div>

        {m.name}

        {hasEditAccess && <span className="ml-2">×</span>}
      </div>
    ));
  }, [mentions, hasEditAccess, setAgent]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Selected tools */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Selected Tools</div>
        <div className="flex gap-2 items-center flex-wrap min-h-[2rem] p-3 rounded-md bg-secondary/50 border">
          {isLoadingTool ? (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader className="size-4 animate-spin" />
              Loading tools...
            </span>
          ) : selectedMentions.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("noToolsSelected")}
            </span>
          ) : (
            selectedMentions
          )}
        </div>
      </div>

      {/* Available tools */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="text-sm font-medium">Available Tools</div>

        {/* Search */}
        <div className="relative mt-2">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("searchTools")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tool tabs */}
        <Tabs defaultValue="workflows" className="flex-1 flex flex-col mt-2">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="workflows" className="flex items-center gap-2">
              Workflows ({workflowTools.length})
            </TabsTrigger>
            <TabsTrigger value="mcp" className="flex items-center gap-2">
              MCP Servers ({mcpTools.length})
            </TabsTrigger>
            <TabsTrigger value="builtin" className="flex items-center gap-2">
              Built-in ({defaultTools.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="mt-2">
            <ToolList
              tools={workflowTools}
              selectedIds={selectedIds}
              onToggleTool={handleToggleTool}
              hasEditAccess={hasEditAccess}
              isToolSelected={isToolSelected}
            />
          </TabsContent>

          <TabsContent value="mcp" className="mt-2">
            <ToolList
              tools={mcpTools}
              selectedIds={selectedIds}
              onToggleTool={handleToggleTool}
              hasEditAccess={hasEditAccess}
              onToggleExpand={handleToggleExpand}
              isToolSelected={isToolSelected}
            />
          </TabsContent>

          <TabsContent value="builtin" className="mt-2">
            <ToolList
              tools={defaultTools}
              selectedIds={selectedIds}
              onToggleTool={handleToggleTool}
              hasEditAccess={hasEditAccess}
              isToolSelected={isToolSelected}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

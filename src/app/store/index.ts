import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatMention, ChatModel, ChatThread } from "app-types/chat";
import { AllowedMCPServer, MCPServerInfo } from "app-types/mcp";
import { OPENAI_VOICE } from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { WorkflowSummary } from "app-types/workflow";
import { AppDefaultToolkit } from "lib/ai/tools";
import { AgentSummary } from "app-types/agent";
import { ArchiveWithItemCount } from "app-types/archive";

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  isUploading?: boolean;
  progress?: number;
  previewUrl?: string;
  abortController?: AbortController;
  dataUrl?: string; // Full data URL format: "data:image/png;base64,..."
}

export type TeamTabMode = "comparison" | "task" | "debate" | "discussion";

export interface RightPanelTab {
  id: "team" | "history" | "web" | "chart" | "code" | "tempchat" | "voice";
  mode?: TeamTabMode;
  title: string;
  content: any;
  threadId?: string;
  hidden?: boolean;
}

export interface AppState {
  threadList: ChatThread[];
  mcpList: (MCPServerInfo & { id: string })[];
  agentList: AgentSummary[];
  workflowToolList: WorkflowSummary[];
  currentThreadId: ChatThread["id"] | null;
  toolChoice: "auto" | "manual" | "approval";
  allowedMcpServers?: Record<string, AllowedMCPServer>;
  allowedAppDefaultToolkit?: AppDefaultToolkit[];
  generatingTitleThreadIds: string[];
  archiveList: ArchiveWithItemCount[];
  threadMentions: {
    [threadId: string]: ChatMention[];
  };
  threadFiles: {
    [threadId: string]: UploadedFile[];
  };
  threadImageToolModel: {
    [threadId: string]: string | undefined;
  };
  toolPresets: {
    allowedMcpServers?: Record<string, AllowedMCPServer>;
    allowedAppDefaultToolkit?: AppDefaultToolkit[];
    name: string;
  }[];
  chatModel?: ChatModel;
  openShortcutsPopup: boolean;
  openChatPreferences: boolean;
  openUserSettings: boolean;
  temporaryChat: {
    isOpen: boolean;
    instructions: string;
    chatModel?: ChatModel;
  };
  voiceChat: {
    agentId?: string;
    options: {
      provider: string;
      providerOptions?: Record<string, any>;
    };
  };
  pendingThreadMentions?: ChatMention[];
  newChatHandler?: () => void;
  groupChatMode: string; // 'comparison', 'discussion', 'chain', 'task', 'debate'
  rightPanel: {
    isOpen: boolean;
    tabs: RightPanelTab[];
    activeTabId?: string;
    panelSizes: [number, number]; // [left%, right%]
  };
  rightPanelRuntime?: Record<string, any>;
}

export interface AppDispatch {
  mutate: (state: Mutate<AppState>) => void;
}

const initialState: AppState = {
  threadList: [],
  archiveList: [],
  generatingTitleThreadIds: [],
  threadMentions: {},
  threadFiles: {},
  threadImageToolModel: {},
  mcpList: [],
  agentList: [],
  workflowToolList: [],
  currentThreadId: null,
  toolChoice: "auto",
  allowedMcpServers: undefined,
  openUserSettings: false,
  allowedAppDefaultToolkit: [
    AppDefaultToolkit.Code,
    AppDefaultToolkit.Visualization,
  ],
  toolPresets: [],
  chatModel: undefined,
  openShortcutsPopup: false,
  openChatPreferences: false,
  temporaryChat: {
    isOpen: false,
    instructions: "",
  },
  voiceChat: {
    options: {
      provider: "openai",
      providerOptions: {
        model: OPENAI_VOICE["Alloy"],
      },
    },
  },
  pendingThreadMentions: undefined,
  newChatHandler: undefined,
  groupChatMode: "comparison",
  rightPanel: {
    isOpen: false,
    tabs: [],
    activeTabId: undefined,
    panelSizes: [60, 40],
  },
  rightPanelRuntime: {},
};

/**
 * Reset chat state to initial state (for Logo button)
 * Clears all chat-related data including messages, agents, files, and panels
 */
export const resetChatState = () => {
  appStore.setState((prev) => ({
    // Clear all thread-specific data
    threadMentions: {},
    threadFiles: {},
    threadImageToolModel: {},
    pendingThreadMentions: undefined,
    currentThreadId: null,

    // Clear right panel
    rightPanel: {
      ...prev.rightPanel,
      tabs: [],
      activeTabId: undefined,
      isOpen: false,
    },

    // Clear internal state for agent model management
    ...((prev as any)._agentManualModelByThread
      ? { _agentManualModelByThread: {} }
      : {}),
    ...((prev as any)._previousModelByThread
      ? { _previousModelByThread: {} }
      : {}),
  }));
};

export const appStore = create<AppState & AppDispatch>()(
  persist(
    (set) => ({
      ...initialState,
      mutate: set,
    }),
    {
      name: "mc-app-store-v2.0.1",
      partialize: (state) => ({
        chatModel: state.chatModel || initialState.chatModel,
        toolChoice: state.toolChoice || initialState.toolChoice,
        allowedMcpServers:
          state.allowedMcpServers || initialState.allowedMcpServers,
        allowedAppDefaultToolkit: (
          state.allowedAppDefaultToolkit ??
          initialState.allowedAppDefaultToolkit
        )?.filter((v) => Object.values(AppDefaultToolkit).includes(v)),
        temporaryChat: {
          ...initialState.temporaryChat,
          ...state.temporaryChat,
          isOpen: false,
        },
        toolPresets: state.toolPresets || initialState.toolPresets,
        voiceChat: {
          ...initialState.voiceChat,
          ...state.voiceChat,
        },
        groupChatMode: state.groupChatMode ?? initialState.groupChatMode,
        rightPanel: {
          ...initialState.rightPanel,
          ...state.rightPanel,
          isOpen: false, // 不持久化打开状态
        },
      }),
    },
  ),
);

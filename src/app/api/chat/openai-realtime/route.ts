import { NextRequest } from "next/server";
import { getSession } from "auth/server";
import { VercelAIMcpTool } from "app-types/mcp";
import {
  filterMcpServerCustomizations,
  loadMcpTools,
  mergeSystemPrompt,
} from "../shared.chat";
import {
  buildMcpServerCustomizationsSystemPrompt,
  buildSpeechSystemPrompt,
} from "lib/ai/prompts";

import { safe } from "ts-safe";
import { DEFAULT_VOICE_TOOLS } from "lib/ai/speech";
import {
  rememberAgentAction,
  rememberMcpServerCustomizationsAction,
} from "../actions";
import globalLogger from "lib/logger";
import { colorize } from "consola/utils";
import { getUserPreferences } from "lib/user/server";
import { ChatMention } from "app-types/chat";
import { getAudioModelProvider } from "lib/ai/audio-model";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `OpenAI Realtime API: `),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get user preferences to retrieve audio model configuration
    const userPreferences = await getUserPreferences(session.user.id);

    // Check if user has configured an audio model
    if (!userPreferences?.botAudioModel) {
      return new Response(
        JSON.stringify({
          error: "Please configure your audio model in Chat Preferences",
        }),
        {
          status: 400,
        },
      );
    }

    // Get audio model provider configuration from database
    const audioModelConfig = await getAudioModelProvider(
      userPreferences.botAudioModel,
    );

    if (!audioModelConfig) {
      return new Response(
        JSON.stringify({
          error:
            "Selected audio model is not available or has been disabled. Please check your preferences.",
        }),
        {
          status: 400,
        },
      );
    }

    const { provider, llmConfig } = audioModelConfig;

    logger.info(
      `Using audio model: ${provider.name}/${llmConfig.id} (${provider.alias})`,
    );

    const { voice, mentions, agentId } = (await request.json()) as {
      model: string;
      voice: string;
      agentId?: string;
      mentions: ChatMention[];
    };

    const agent = await rememberAgentAction(agentId, session.user.id);

    agentId && logger.info(`[${agentId}] Agent: ${agent?.name}`);

    const enabledMentions = agent?.tools ?? mentions;

    const allowedMcpTools = await loadMcpTools({ mentions: enabledMentions });

    const toolNames = Object.keys(allowedMcpTools ?? {});

    if (toolNames.length > 0) {
      logger.info(`${toolNames.length} tools found`);
    } else {
      logger.info(`No tools found`);
    }

    const mcpServerCustomizations = await safe()
      .map(() => {
        if (Object.keys(allowedMcpTools ?? {}).length === 0)
          throw new Error("No tools found");
        return rememberMcpServerCustomizationsAction(session.user.id);
      })
      .map((v) => filterMcpServerCustomizations(allowedMcpTools!, v))
      .orElse({});

    const openAITools = Object.entries(allowedMcpTools ?? {}).map(
      ([name, tool]) => {
        return vercelAIToolToOpenAITool(tool, name);
      },
    );

    const systemPrompt = mergeSystemPrompt(
      buildSpeechSystemPrompt(
        session.user,
        userPreferences ?? undefined,
        agent,
      ),
      buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
    );

    const bindingTools = [...openAITools, ...DEFAULT_VOICE_TOOLS];

    // Construct dynamic Realtime API endpoint
    const realtimeUrl = `${provider.baseUrl}/realtime/sessions`;

    logger.info(`Realtime endpoint: ${realtimeUrl}`);

    // Create session using provider configuration from database
    const r = await fetch(realtimeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: llmConfig.id, // Use model ID from database
        voice: voice || "alloy",
        input_audio_transcription: {
          model: "whisper-1",
        },
        instructions: systemPrompt,
        tools: bindingTools,
      }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      logger.error(`Realtime API error: ${r.status} - ${errorText}`);
      throw new Error(`Failed to create realtime session: ${errorText}`);
    }

    return new Response(r.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    logger.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

function vercelAIToolToOpenAITool(tool: VercelAIMcpTool, name: string) {
  return {
    name,
    type: "function",
    description: tool.description,
    parameters: (tool.inputSchema as any).jsonSchema ?? {
      type: "object",
      properties: {},
      required: [],
    },
  };
}

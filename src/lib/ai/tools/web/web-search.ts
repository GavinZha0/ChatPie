import { tool as createTool } from "ai";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import {
  ExaContentsRequest,
  ExaSearchRequest,
  exaContentsSchema,
  exaSearchSchema,
  EXA_CONTENTS_DESCRIPTION,
  EXA_SEARCH_DESCRIPTION,
} from "./web-search.shared";

// Exa API Types

let exaConfigCache: {
  apiKey: string | null;
  baseUrl: string | null;
  timestamp: number;
} | null = null;
const EXA_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getExaConfig(): Promise<{
  apiKey?: string;
  baseUrl: string;
}> {
  if (exaConfigCache && Date.now() - exaConfigCache.timestamp < EXA_CACHE_TTL) {
    return {
      apiKey: exaConfigCache.apiKey || undefined,
      baseUrl: exaConfigCache.baseUrl || "https://api.exa.ai",
    };
  }
  const { providerRepository } = await import("lib/db/repository");
  const provider = await providerRepository.selectByName("exa");
  exaConfigCache = {
    apiKey: provider?.apiKey ?? null,
    baseUrl: provider?.baseUrl ?? null,
    timestamp: Date.now(),
  };
  return {
    apiKey: exaConfigCache.apiKey || undefined,
    baseUrl: exaConfigCache.baseUrl || "https://api.exa.ai",
  };
}

export function invalidateExaConfigCache() {
  exaConfigCache = null;
}

const fetchExa = async (endpoint: string, body: any): Promise<any> => {
  const { apiKey, baseUrl } = await getExaConfig();
  if (!apiKey) {
    throw new Error("Exa API key is not configured");
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error("Invalid EXA API key");
  }
  if (response.status === 429) {
    throw new Error("Exa API usage limit exceeded");
  }

  if (!response.ok) {
    throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

export const exaSearchToolForWorkflow = createTool({
  description: EXA_SEARCH_DESCRIPTION,
  inputSchema: jsonSchemaToZod(exaSearchSchema),
  execute: async (params) => {
    const searchRequest: ExaSearchRequest = {
      query: params.query,
      type: params.type || "auto",
      numResults: params.numResults || 5,
      contents: {
        text: {
          maxCharacters: params.maxCharacters || 3000,
        },
        livecrawl: "preferred",
      },
    };

    // Add optional parameters if provided
    if (params.category) searchRequest.category = params.category;
    if (params.includeDomains?.length)
      searchRequest.includeDomains = params.includeDomains;
    if (params.excludeDomains?.length)
      searchRequest.excludeDomains = params.excludeDomains;
    if (params.startPublishedDate)
      searchRequest.startPublishedDate = params.startPublishedDate;
    if (params.endPublishedDate)
      searchRequest.endPublishedDate = params.endPublishedDate;

    return fetchExa("/search", searchRequest);
  },
});

export const exaContentsToolForWorkflow = createTool({
  description: EXA_CONTENTS_DESCRIPTION,
  inputSchema: jsonSchemaToZod(exaContentsSchema),
  execute: async (params) => {
    const contentsRequest: ExaContentsRequest = {
      ids: params.urls,
      contents: {
        text: {
          maxCharacters: params.maxCharacters || 3000,
        },
        livecrawl: params.livecrawl || "preferred",
      },
    };

    return fetchExa("/contents", contentsRequest);
  },
});

export const exaSearchTool = createTool({
  description: EXA_SEARCH_DESCRIPTION,
  inputSchema: jsonSchemaToZod(exaSearchSchema),
  execute: (params) => {
    return safe(async () => {
      const searchRequest: ExaSearchRequest = {
        query: params.query,
        type: params.type || "auto",
        numResults: params.numResults || 5,
        contents: {
          text: {
            maxCharacters: params.maxCharacters || 3000,
          },
          livecrawl: "preferred",
        },
      };

      // Add optional parameters if provided
      if (params.category) searchRequest.category = params.category;
      if (params.includeDomains?.length)
        searchRequest.includeDomains = params.includeDomains;
      if (params.excludeDomains?.length)
        searchRequest.excludeDomains = params.excludeDomains;
      if (params.startPublishedDate)
        searchRequest.startPublishedDate = params.startPublishedDate;
      if (params.endPublishedDate)
        searchRequest.endPublishedDate = params.endPublishedDate;

      const result = await fetchExa("/search", searchRequest);

      return {
        ...result,
        guide: `Use the search results to answer the user's question. Summarize the content and ask if they have any additional questions about the topic.`,
      };
    })
      .ifFail((e) => {
        return {
          isError: true,
          error: e.message,
          solution:
            "A web search error occurred. First, explain to the user what caused this specific error and how they can resolve it. Then provide helpful information based on your existing knowledge to answer their question.",
        };
      })
      .unwrap();
  },
});

export const exaContentsTool = createTool({
  description: EXA_CONTENTS_DESCRIPTION,
  inputSchema: jsonSchemaToZod(exaContentsSchema),
  execute: async (params) => {
    return safe(async () => {
      const contentsRequest: ExaContentsRequest = {
        ids: params.urls,
        contents: {
          text: {
            maxCharacters: params.maxCharacters || 3000,
          },
          livecrawl: params.livecrawl || "preferred",
        },
      };

      return await fetchExa("/contents", contentsRequest);
    })
      .ifFail((e) => {
        return {
          isError: true,
          error: e.message,
          solution:
            "A web content extraction error occurred. First, explain to the user what caused this specific error and how they can resolve it. Then provide helpful information based on your existing knowledge to answer their question.",
        };
      })
      .unwrap();
  },
});

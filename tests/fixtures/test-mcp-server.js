import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "custom-mcp-server",
  version: "0.0.1",
});

const getWeatherSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

server.registerTool(
  "get_weather",
  {
    title: "Get Weather",
    description: "Get the current weather at a location.",
    inputSchema: getWeatherSchema.shape,
  },
  async (args, _extra) => {
    const { latitude, longitude } = getWeatherSchema.parse(args);
    return {
      content: [
        {
          type: "text",
          text: `The current temperature in ${latitude}, ${longitude} is 20°C.`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();

await server.connect(transport);

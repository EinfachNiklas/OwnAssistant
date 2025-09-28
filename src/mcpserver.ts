import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "ownassistant-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

server.registerTool(
    "get_current_datetime",
    {
        title: "Get current datetime",
        description: "Get the current systemtime and date",
        inputSchema: {}
    },
    async () => {
        const current_datetime = new Date().toString();
        return {
            content: [{ type: "text", text: `The current date and time is: ${current_datetime}` }]
        };
    },

);

const transport = new StdioServerTransport();
await server.connect(transport);
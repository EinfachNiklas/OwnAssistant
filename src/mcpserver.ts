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

const transport = new StdioServerTransport();
await server.connect(transport);
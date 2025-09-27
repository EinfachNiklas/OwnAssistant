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
        inputSchema: {
        },
    },
    async ({ }) => {
        const current_datetime = new Date().toString();
        return {
            content: [{ type: "text", text: `The current date and time is: ${current_datetime}` }]
        };
    },

);


server.registerTool(
    "add_event",
    {
        title: "Add Event",
        description: "Add an Event to the calendar",
        inputSchema: {
            title: z.string().describe("The title for the event"),
            datetime: z.string().describe("The Datetime of the event in format YYYY-MM-DDTHH:MM:SS"),
        },
    },
    async ({ title, datetime }) => {
        return {
            content: [{ type: "text", text: `event for ${JSON.stringify({ title: title, datetime: datetime })} created` }]
        };
    },

);

const transport = new StdioServerTransport();
await server.connect(transport);
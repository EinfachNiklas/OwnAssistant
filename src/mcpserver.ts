import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { start } from "node:repl";
import { z } from "zod";
import { getEvents, createEvent } from "./mcptools/googleapi.js";
import { title } from "node:process";
import { create } from "node:domain";

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

// Google APIs

server.registerTool(
    "get_events",
    {
        title: "Get Events",
        description: "Get Events from the Calendar for a certain time period (up to 10)",
        inputSchema: {
            startTime: z.string().describe("The start of the selection period strictly in the format YYYY-MM-DDTHH:MM:SS or 'default'. If 'default', the current datetime is used."),
            endTime: z.string().describe("The end of the selection period strictly in format YYYY-MM-DDTHH:MM:SS or 'default'. The end datetime must be after the start. If 'default', the next year is used."),
        },
    },
    async ({ startTime, endTime }) => {
        const start = startTime === "default" ? new Date() : new Date(startTime);
        const end = endTime === "default" ? new Date(new Date().getFullYear() + 1) : new Date(endTime);

        const events = await getEvents(start, end);
        return {
            content: [{ type: "text", text: `The upcoming events are ${JSON.stringify(events)}` }]
        };
    }
);

server.registerTool(
    "create_event",
    {
        title: "Create Events",
        description: "Create an event on the users calendar.",
        inputSchema: {
            title: z.string().describe("The title of the event"),
            start: z.string().describe("The start time of the event in format YYYY-MM-DDTHH:MM:SS"),
            end: z.string().describe("The end time of the event in format YYYY-MM-DDTHH:MM:SS")
        }
    },
    async ({title, start, end}) => {
        const startTime = new Date(start);
        const endTime = new Date(end);
        const event = createEvent(title, startTime, endTime);
        return {
            content: [{ type: "text", text: `Created the event ${JSON.stringify(event)}` }]
        };
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
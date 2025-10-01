import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getEvents, createEvent } from "./mcptools/googleapi.js";

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
        description: "Get Events from the Calendar for a certain time period (up to 25 events)",
        inputSchema: {
            startTime: z.string().describe("The start of the selection period strictly in the format YYYY-MM-DDTHH:MM:SS or 'default'. If 'default', the current datetime is used."),
            endTime: z.string().describe("The end of the selection period strictly in format YYYY-MM-DDTHH:MM:SS or 'default'. The end datetime must be after the start. If 'default', the next year is used."),
        },
    },
    async ({ startTime, endTime }) => {
        const start = startTime === "default" ? new Date() : new Date(startTime);
        const end = endTime === "default" ? (() => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date; })() : new Date(endTime);
        try {
            const events = await getEvents(start, end);
            return {
                content: [{ type: "text", text: `The upcoming events are ${JSON.stringify(events)}` }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `There was an error in calling this tool. ${error.message}. Please check your input and try again.` }]
            };
        }
    }
);

server.registerTool(
    "create_event",
    {
        title: "Create Events",
        description: "Create an event on the users calendar.",
        inputSchema: {
            title: z.string().describe("The title of the event"),
            start: z.string().describe("The start time of the event strictly in format YYYY-MM-DDTHH:MM:SS. It must never not adhere to this format."),
            end: z.string().describe("The end time of the event strictly in format YYYY-MM-DDTHH:MM:SS. It must never not adhere to this format. The end datetime must be after the start.")
        }
    },
    async ({ title, start, end }) => {
        const startTime = new Date(start);
        const endTime = new Date(end);
        try {
            const event = await createEvent(title, startTime, endTime);
            return {
                content: [{ type: "text", text: `Created the event ${JSON.stringify(event)}` }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `There was an error in calling this tool. ${error.message}. Please check your input and try again.` }]
            };
        }
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
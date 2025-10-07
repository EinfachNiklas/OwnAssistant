import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getEvents, createEvent } from "./mcptools/googleapi.js";
import { Current, Forecast, get_current, get_forecast } from "./mcptools/weather.js";

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

// Weather API

server.registerTool(
    "get_weather_forecast",
    {
        title: "Get weather forecast",
        description: "Get the weather forecast for the next 7 days for the users pre-configured position",
        inputSchema: {}
    },
    async () => {
        const forecast: Forecast = await get_forecast();
        return {
            content: [{ type: "text", text: `Weather Forecast ${JSON.stringify(forecast)}` }]
        };
    },
);

server.registerTool(
    "get_weather_current",
    {
        title: "Get current weather",
        description: "Get the current weather for the users pre-configured position",
        inputSchema: {}
    },
    async () => {
        const current: Current = await get_current();
        return {
            content: [{ type: "text", text: `Current Weather ${JSON.stringify(current)}` }]
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
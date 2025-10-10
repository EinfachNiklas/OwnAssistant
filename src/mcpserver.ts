import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getEvents, createEvent } from "./mcptools/googleapi.js";
import { Current, Forecast, get_current, get_forecast } from "./mcptools/weather.js";
import { clearDone, createEntry, DBEntry, getAllEntries, getOpenEntries, setDoneStatus, Tables } from "./mcptools/db.js";

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
        try {
            if (startTime.length === 0 || endTime.length === 0) {
                throw new Error("At least 1 Parameter is empty.");
            }
            const start = startTime === "default" ? new Date() : new Date(startTime);
            const end = endTime === "default" ? (() => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date; })() : new Date(endTime);
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
        try {
            if (title.length === 0 || start.length === 0 || end.length === 0) {
                throw new Error("At least 1 Parameter is empty.");
            }
            const startTime = new Date(start);
            const endTime = new Date(end);
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
        try {
            const forecast: Forecast = await get_forecast();
            return {
                content: [{ type: "text", text: `Weather Forecast ${JSON.stringify(forecast)}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error fetching the weather forecast. ${error?.message ?? error}`
                }]
            };
        }
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
        try {
            const current: Current = await get_current();
            return {
                content: [{ type: "text", text: `Current Weather ${JSON.stringify(current)}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error fetching the current weather. ${error?.message ?? error}`
                }]
            };
        }
    },
);

// Shopping List
server.registerTool(
    "create_shoppinglist_entry",
    {
        title: "Create Shoppinglist Entry",
        description: "Create an Entry on the users shoppinglist",
        inputSchema: {
            title: z.string().describe("The title of the shopping list entry")
        }
    },
    async ({ title }) => {
        try {
            if (title.length === 0) {
                throw new Error("Parameter 'title' is empty.");
            }
            await createEntry(title, Tables.shoppinglist);
            return {
                content: [{ type: "text", text: `Created Entry ${title}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when creating the entry: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "get_shoppinglist_entries",
    {
        title: "Get Shoppinglist Entries",
        description: "Get a list of Entries from the users shoppinglist",
        inputSchema: {
            mode: z.enum(["all", "open"]).describe("Defines if all entries should be returned or only the ones that are open (not done)")
        }
    },
    async ({ mode }) => {
        try {
            let entries: DBEntry[];
            switch (mode) {
                case "all":
                    entries = await getAllEntries(Tables.shoppinglist);
                    break;
                case "open":
                    entries = await getOpenEntries(Tables.shoppinglist);
                    break;
                default:
                    throw new Error("Wrong mode input. Only 'all' or 'open supported");
            }
            return {
                content: [{ type: "text", text: `${mode} Entries: ${JSON.stringify(entries)}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when fetching the entries: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "set_shoppinglist_done_status",
    {
        title: "Set shoppinglist doneStatus",
        description: "Set the doneStatus of a shoppinglist entry. Should be called if an item is bought.",
        inputSchema: {
            title: z.string().describe("The title of the shopping list entry to set the doneStatus. If you are unsure of the possible titles run tool get_shoppinglist_entries"),
            doneStatus: z.enum(["true", "false"]).describe("The new doneStatus value of the shoppinglist entry as a string ('true' pr 'false')")
        }
    },
    async ({ title, doneStatus }) => {
        try {
            if (title.length === 0) {
                throw new Error("Parameter 'title' is empty.");
            }
            await setDoneStatus(title, (doneStatus === "true" ? true : false), Tables.shoppinglist);
            return {
                content: [{ type: "text", text: `Updated isDone of Entry ${title} to ${doneStatus}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when setting the doneStatus for the shoppinglist entry ${title}: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "clear_done_shoppinglist",
    {
        title: "Clear all done shoppinglist entries",
        description: "Delete all Entries from the users shoppinglist where isDone = true. If you want to give a summary of the remaining shopping list call tool get_shoppinglist_entries",
        inputSchema: {}
    },
    async () => {
        try {
            await clearDone(Tables.shoppinglist);
            return {
                content: [{ type: "text", text: `Cleared all done shoppinglist entries` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when clearing the done shoppinglist entries: ${error?.message ?? error}`
                }]
            };
        }
    },
);

// ToDo List
server.registerTool(
    "create_todolist_entry",
    {
        title: "Create ToDo List Entry",
        description: "Create an Entry on the users todo list",
        inputSchema: {
            title: z.string().describe("The title of the todo list entry")
        }
    },
    async ({ title }) => {
        try {
            if (title.length === 0) {
                throw new Error("Parameter 'title' is empty.")
            }
            await createEntry(title, Tables.todos);
            return {
                content: [{ type: "text", text: `Created Entry ${title}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when creating the entry: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "get_todolist_entries",
    {
        title: "Get ToDo List Entries",
        description: "Get a list of Entries from the users todo list",
        inputSchema: {
            mode: z.enum(["all", "open"]).describe("Defines if all entries should be returned or only the ones that are open (not done)")
        }
    },
    async ({ mode }) => {
        try {
            let entries: DBEntry[];
            switch (mode) {
                case "all":
                    entries = await getAllEntries(Tables.todos);
                    break;
                case "open":
                    entries = await getOpenEntries(Tables.todos);
                    break;
                default:
                    throw new Error("Wrong mode input. Only 'all' or 'open supported");
            }
            return {
                content: [{ type: "text", text: `${mode} Entries: ${JSON.stringify(entries)}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when fetching the entries: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "set_todolist_done_status",
    {
        title: "Set ToDo List doneStatus",
        description: "Set the doneStatus of a todo list entry. Should be called if an entry is done.",
        inputSchema: {
            title: z.string().describe("The title of the ToDo List entry to set the doneStatus. If you are unsure of the possible titles run tool get_todolist_entries"),
            doneStatus: z.enum(["true", "false"]).describe("The new doneStatus value of the ToDo List entry as a string ('true' pr 'false')")
        }
    },
    async ({ title, doneStatus }) => {
        try {
            if (title.length === 0) {
                throw new Error("Parameter 'title' is empty.")
            }
            await setDoneStatus(title, (doneStatus === "true" ? true : false), Tables.todos);
            return {
                content: [{ type: "text", text: `Updated isDone of Entry ${title} to ${doneStatus}` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when setting the doneStatus for the ToDo List entry ${title}: ${error?.message ?? error}`
                }]
            };
        }
    },
);

server.registerTool(
    "clear_done_todolist",
    {
        title: "Clear all done ToDo List entries",
        description: "Delete all Entries from the users ToDo List where isDone = true. If you want to give a summary of the remaining ToDos, call tool get_todoist_entries",
        inputSchema: {}
    },
    async () => {
        try {
            await clearDone(Tables.todos);
            return {
                content: [{ type: "text", text: `Cleared all done ToDo List entries` }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `There was an error when clearing the done ToDo List entries: ${error?.message ?? error}`
                }]
            };
        }
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
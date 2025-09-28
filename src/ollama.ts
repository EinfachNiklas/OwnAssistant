import ollama, { ChatResponse, Message } from "ollama";
import mcpclient from "./mcpclient.js";
import ora from "ora";
import { readFileSync } from "fs";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_CHAT_ITERATIONS = Number(process.env.MAX_CHAT_ITERATIONS) || 6;
const promptTemplates = JSON.parse(await readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
const mcpTools = await mcpclient.listTools();

type OllamaTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, any>;
    };
};


const ollamaTools: OllamaTool[] = mcpTools.tools.map((t) => ({
    type: "function",
    function: {
        name: t.name,
        description: t.description ?? "",
        parameters:
            t.inputSchema ?? { type: "object", properties: {} },
    },
}));



const handleResponse = async (messages: Message[], response: ChatResponse) => {
    messages.push(response.message);
    const calls = response.message?.tool_calls ?? [];
    if (response.message.tool_calls && calls.length !== 0) {
        for (let i = 0; i < calls.length; i++) {
            const toolCall = calls[i];
            console.info("[TOOL]" + toolCall.function.name, toolCall.function.arguments);
            const toolRes = await mcpclient.callTool({
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
            });
            messages.push({ role: "tool", content: JSON.stringify(toolRes.content) as string, tool_name: toolCall.function.name });
        }
    }
}

export async function setupLLM(modelName: string) {
    console.log("Setting Up LLM...");
    const models = (await ollama.list()).models;
    if (!models.map(model => model.name).includes(modelName)) {
        console.log(`Model ${modelName} not installed`);
        const sp = ora(`Downloading Model ${modelName}`).start();
        await ollama.pull({ model: modelName });
        sp.succeed(`Model ${modelName} downloaded`);
    } else {
        console.log(`Model ${modelName} found`);
    }
    console.log("LLM-Setup complete")
}

export async function callLLM(model: string, message: Message) {
    const messages: Message[] = [promptTemplates.introduction, { role: "system", content: `This is some context for you to make further decisions: current time: ${new Date().toString()}` }, message];
    let done = false;
    for (let i = 0; i < MAX_CHAT_ITERATIONS && !done; i++) {
        const response = await ollama.chat({
            model: model,
            messages: messages,
            tools: ollamaTools,
            keep_alive: "5m",
            options: {
                num_ctx: 2048
            }
        });
        await handleResponse(messages, response);
        const toolCalls = response.message?.tool_calls ?? [];
        if (toolCalls.length === 0) {
            done = true;
        }
    }
    return messages;
}

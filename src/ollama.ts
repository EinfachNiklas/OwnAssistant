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
    const [toolCall, ...callOverflow] = response.message?.tool_calls ?? [];
    if (toolCall) {
        console.info("[TOOL]" + toolCall.function.name, toolCall.function.arguments);
        if (callOverflow.length > 0) {
            messages.push({
                role: "system",
                content:
                    `Policy reminder: You must return at most ONE tool_call per assistant turn. Extra tool_calls (${callOverflow.length}) were ignored. Please call the tool that were not executed again one by one. The ignored tools are ${JSON.stringify(callOverflow)}`
            });
        }
        const toolRes = await mcpclient.callTool({
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
        });
        messages.push({ role: "tool", content: JSON.stringify(toolRes.content) as string, tool_name: toolCall.function.name });
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
                temperature: 0.1 - 0.25,
                top_p: 0.9,
                top_k: 40,           
                repeat_penalty: 1.1,
                num_ctx: 3000
            }
        });
        await handleResponse(messages, response);
        const toolCalls = response.message?.tool_calls ?? [];

        console.info("Res: " + JSON.stringify(response, null, 2));
        if (toolCalls.length === 0) {
            done = true;
        }
    }
    return messages;
}

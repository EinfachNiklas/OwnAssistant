import ollama, { ChatResponse, Message, ToolCall } from "ollama";
import mcpclient from "./mcpclient.js";
import ora from "ora";
import { readFileSync } from "fs";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_CHAT_ITERATIONS = Number(process.env.MAX_CHAT_ITERATIONS) || 6;
const mcpTools = await mcpclient.listTools();
let signal_done = false;

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
}));;

ollamaTools.push({
    type: "function",
    function: {
        name: "signal_done",
        description: "Call this when you are completely done using tools and ready to give the final answer to the user.",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    }
});
const allowedToolNames = new Set(ollamaTools.map(t => t.function.name));


function parseToolCallFromContent(msg: Message): ToolCall | null {
  if (!msg.content) return null;

  const trimmed = msg.content.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj.name !== "string") return null;
    if (obj.parameters === undefined) return null;

    if (!allowedToolNames.has(obj.name)) {
        //ignore
      return null;
    }

    return {function : { name : obj.name, arguments: obj.parameters } };
  } catch {
    return null;
  }
}

const handleResponse = async (messages: Message[], response: ChatResponse) => {
    messages.push(response.message);
    let [toolCall, ...callOverflow] = response.message?.tool_calls ?? [];
    if(toolCall === undefined || !toolCall){
        toolCall = parseToolCallFromContent(response.message)!;
    }
    if (toolCall) {
        console.info("[TOOL]" + toolCall.function.name, toolCall.function.arguments);
        if (callOverflow.length > 0) {
            messages.push({
                role: "user",
                content:
                    `Policy reminder: You must return at most ONE tool_call per assistant turn. Extra tool_calls (${callOverflow.length}) were ignored. Please call the tool that were not executed again one by one. The ignored tools are ${JSON.stringify(callOverflow)}`
            });
        	return;
	}
	if (!allowedToolNames.has(toolCall.function.name)) {
		messages.push({
                role: "user",
                content:
                    `This tool does not exist.` });

		return;
	}
        if (toolCall.function.name === "signal_done") {
            signal_done = true;
            messages.push({
                role: "tool",
                tool_name: "signal_done",
                content: JSON.stringify({ status: "ok" }),
            });
            return;
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
    const messages: Message[] = [{role: "user", content: `You are a local personal assistant that can call MCP tools. Your job is to complete the users task reliably and efficiently with minimal context usage.\n\nCRITICAL TOOL USE RULES:\n- You may call tools, but you MUST return at most ONE tool_call per assistant message.\n- If you call a tool, your assistant message MUST have empty 'content' and include exactly ONE 'tool_call'.\n- Do NOT mix natural language text with a tool call in the same message.\n- After you call a tool, WAIT for a message with role = \"tool\" (the tool result) before deciding what to do next.\n- If you need multiple tools, use them SEQUENTIALLY: one tool_call per turn, using the latest tool results.\n- If a tool error is likely caused by your arguments, fix the input and try again ONCE. Otherwise, briefly explain the error in natural language and stop or ask how to proceed.\n- Never invent tool names or parameters. Use the tool schemas exactly as provided.\n-When you are done using other tools and ready to answer finally, call the signal_done tool once.\n\nGENERAL BEHAVIOR:\n- Mirror the users language and tone (default to the users language).\n- Be concise and clear. Avoid fluff, small talk, and roleplay.\n- Do not invent facts. If a required detail is missing, ask ONE brief clarifying question.\n- Prefer short natural language answers. Use structured lists or JSON only if the user asks or if a tool specifically requires it.\n\nTIME & CONTEXT:\n- Treat any explicit time/context messages you receive as the source of truth.\n- Format dates, times, and numbers according to the users locale when possible.`}
        , { role: "user", content: `This is some context for you to make further decisions: current time: ${new Date().toString()}` }, message];
    let done = false;
    for (let i = 0; i < MAX_CHAT_ITERATIONS && !done; i++) {
        const response = await ollama.chat({
            model: model,
            messages: messages,
            tools: ollamaTools,
            keep_alive: "1m",
            options: {
                temperature: 0.1,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                num_ctx: 3000,
                num_gpu: 30,
            }
        });
        await handleResponse(messages, response);
        console.info(`[TOOL2] ${JSON.stringify(response.message.tool_calls)}`);
        if(response.message.tool_calls === undefined || response.message.tool_calls[0] === undefined || signal_done){
            done = true;
        }
    }
    messages.push({
        role: "user",
        content:
            "Now produce a concise final answer for the user based on the conversation and the tool results above. " +
            "Do NOT call any tools. Do NOT output JSON. Answer in plain natural language. Answer in the language, the user provided the question in.",
    },)
    const finalResponse = await ollama.chat({
        model: model,
        messages: messages,
        keep_alive: "1m",
        options: {
            temperature: 0.1,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            num_ctx: 3000,
            num_gpu: 30
        }
    });
    messages.push(finalResponse.message);
    return messages;
}

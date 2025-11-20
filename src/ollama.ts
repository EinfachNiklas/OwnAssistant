import ollama, { ChatResponse, Message, ToolCall } from "ollama";
import mcpclient from "./mcpclient.js";
import ora from "ora";

const MAX_CHAT_ITERATIONS = Number(process.env.MAX_CHAT_ITERATIONS) || 6;
const rawNumGpu = process.env.NUM_GPU;

const parsed = rawNumGpu !== undefined ? Number(rawNumGpu) : undefined;
const NUM_GPU = Number.isFinite(parsed as number) ? (parsed as number) : 15;
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


export async function setupLLM(modelName: string) {
	if (!modelName) {
		modelName = "llama3.1:8b-instruct-q4_0";
	}
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

function parseToolCallFromContent(msg: Message): ToolCall | null {
	if (!msg.content) return null;

	const trimmed = msg.content.trim();

	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

	try {
		const obj = JSON.parse(trimmed);
		if (typeof obj.name !== "string") return null;
		if (obj.parameters === undefined) return null;
		return { function: { name: obj.name, arguments: obj.parameters } };
	} catch {
		return null;
	}
}

const handleResponse = async (messages: Message[], response: ChatResponse, signalDone: {value: Boolean}) => {
	let contentCall: ToolCall | null = null;
	messages.push(response.message);
	let [toolCall, ...callOverflow] = response.message?.tool_calls ?? [];
	if (toolCall === undefined || toolCall === null) {
		contentCall = parseToolCallFromContent(response.message);
		if (contentCall === undefined || contentCall === null) {
			signalDone.value = true;
			return;
		}
		toolCall = contentCall;
	}
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
				`This tool does not exist. Use a different tool. The tool you tried to use was: ${toolCall.function.name}`,
		});

		return;
	}
	if (toolCall.function.name === "signal_done") {
		signalDone.value = true;
		messages.push({
			role: "tool",
			tool_name: "signal_done",
			content: JSON.stringify({ status: "ok" }),
		});
		return;
	}
	try {
		const toolRes = await mcpclient.callTool({
			name: toolCall.function.name,
			arguments: toolCall.function.arguments
		});
		messages.push({ role: "tool", content: JSON.stringify(toolRes.content) as string, tool_name: toolCall.function.name });
	} catch (error: any) {
		messages.push({
			role: "tool",
			tool_name: toolCall.function.name,
			content: JSON.stringify({ error: `Tool call failed: ${error.message}` }),
		});
	}
}




export async function callLLM(model: string, message: Message) {
	let signalDone = {value: false};
	const messages: Message[] = [{ role: "user", content: `You are a local personal assistant that can call MCP tools. Your job is to complete the users task reliably and efficiently with minimal context usage.\n\nCRITICAL TOOL USE RULES:\n- You may call tools, but you MUST return at most ONE tool_call per assistant message.\n- If you call a tool, your assistant message MUST have empty 'content' and include exactly ONE 'tool_call'.\n- Do NOT mix natural language text with a tool call in the same message.\n- After you call a tool, WAIT for a message with role = \"tool\" (the tool result) before deciding what to do next.\n- If you need multiple tools, use them SEQUENTIALLY: one tool_call per turn, using the latest tool results.\n-If you need to search the web, use the tool web_search_overview. If you feel the need to get more information call the tool web_page_content afterwards. You can do this multiple times if you want to look at multiple web pages.\n- If a tool error is likely caused by your arguments, fix the input and try again ONCE. Otherwise, briefly explain the error in natural language and stop or ask how to proceed.\n- Never invent tool names or parameters. Use the tool schemas exactly as provided.\n-When you are done using other tools and ready to answer finally, call the signal_done tool once.\n\nGENERAL BEHAVIOR:\n- Mirror the users language and tone (default to the users language).\n- Be concise and clear. Avoid fluff, small talk, and roleplay.\n- Do not invent facts. If a required detail is missing, ask ONE brief clarifying question.\n- Prefer short natural language answers. Use structured lists or JSON only if the user asks or if a tool specifically requires it.\n\nTIME & CONTEXT:\n- Treat any explicit time/context messages you receive as the source of truth.\n- Format dates, times, and numbers according to the users locale when possible.` }
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
				num_gpu: NUM_GPU,
			}
		});
		await handleResponse(messages, response, signalDone);
		console.info(`[TOOL2] ${JSON.stringify(response.message.tool_calls)}`);
		if (signalDone.value) {
			done = true;
		}
	}
	messages.push({
		role: "user",
		content:
			`Now produce a final answer for the users question ${message.content} based on the conversation and the tool results above. ` +
			"Do NOT call any tools. Do NOT output JSON. Answer in plain natural language and in the language, that was used with the tag.",
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
			num_gpu: NUM_GPU
		}
	});
	messages.push(finalResponse.message);
	return messages;
}

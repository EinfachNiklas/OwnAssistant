import { callLLM, setupLLM } from "./ollama.js";

const MODEL = process.env.MODEL || 'llama3.2:3b-instruct-q4_K_M';

await setupLLM(MODEL);
const messages = await callLLM(MODEL, {role:"user", content:"What time is it?"});
console.log(messages)
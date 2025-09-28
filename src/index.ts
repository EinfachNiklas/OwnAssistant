import { callLLM, setupLLM } from "./ollama.js";

const MODEL = process.env.MODEL || 'llama3.2:3b-instruct-q4_K_M';

await setupLLM(MODEL);
let messages = await callLLM(MODEL, {role:"user", content:"Create an event for tomorrow 'Lunch' from 1pm to 2pm"});
console.log(messages)
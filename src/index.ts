import { readFileSync } from "node:fs";
import { callLLM, setupLLM } from "./ollama.js";

const MODEL = process.env.MODEL || 'llama3.2:3b-instruct-q4_K_M';

const prompt = readFileSync("prompt.txt", { encoding: "utf-8" });

await setupLLM(MODEL);
let messages = await callLLM(MODEL, {role:"user", content:prompt});
console.log(messages);

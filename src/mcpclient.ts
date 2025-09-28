import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from "node:path";
    
const __dirname = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(__dirname, "mcpserver.js")]
});

const client = new Client(
  {
    name: "ownassistant-mcpclient",
    version: "1.0.0"
  }
);

await client.connect(transport);
export default client;
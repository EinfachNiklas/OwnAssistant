import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/mcpserver.js"]
});

const client = new Client(
  {
    name: "ownassistant-mcpclient",
    version: "1.0.0"
  }
);

await client.connect(transport);
export default client;
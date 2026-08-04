import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { NotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const ResourceChunkNotificationSchema = NotificationSchema.extend({
  method: z.literal("resource_chunk"),
});

export async function connectMcpStdioTestClient(options = {}) {
  const client = new Client(
    {
      name: options.name || "harness-mcp-test-client",
      version: "1.0.0",
    },
    { capabilities: {} },
  );

  if (typeof options.onNotification === "function") {
    client.setNotificationHandler(ResourceChunkNotificationSchema, options.onNotification);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["scripts/harness/mcp-server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe",
    env: { ...process.env },
  });

  const stderrChunks = [];
  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  await client.connect(transport);

  return {
    client,
    stderr() {
      return stderrChunks.join("").trim();
    },
    async close() {
      await transport.close();
    },
  };
}
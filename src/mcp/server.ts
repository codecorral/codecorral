import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ensureDaemon } from "../daemon/client.js";
import type { MessageConnection } from "vscode-jsonrpc/node.js";

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "workflow-engine",
    version: "0.1.0",
  });

  let daemonConnection: MessageConnection | null = null;

  async function getDaemon(): Promise<MessageConnection> {
    if (!daemonConnection) {
      daemonConnection = await ensureDaemon();
    }
    return daemonConnection;
  }

  function resolveInstanceId(explicitId?: string): string | undefined {
    return explicitId ?? process.env.WFE_INSTANCE_ID;
  }

  server.tool(
    "workflow.transition",
    "Fire a workflow transition event",
    {
      event: z.string().describe("Event name (e.g., start, submit, review.approved)"),
      payload: z.record(z.string(), z.unknown()).optional().describe("Optional event payload"),
      instanceId: z.string().optional().describe("Instance ID (defaults to WFE_INSTANCE_ID env)"),
      definitionId: z.string().optional().describe("Definition ID for creating new instances"),
    },
    async ({ event, payload, instanceId, definitionId }) => {
      const id = resolveInstanceId(instanceId);
      if (!id && !definitionId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "No instance context available. Set WFE_INSTANCE_ID or provide instanceId parameter.",
              }),
            },
          ],
        };
      }

      const daemon = await getDaemon();
      const result = await daemon.sendRequest("transition", {
        instanceId: id,
        definitionId,
        event,
        payload,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "workflow.status",
    "Get workflow instance status",
    {
      instanceId: z.string().optional().describe("Instance ID (defaults to WFE_INSTANCE_ID env)"),
    },
    async ({ instanceId }) => {
      const id = resolveInstanceId(instanceId);
      if (!id) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No instance context available." }),
            },
          ],
        };
      }

      const daemon = await getDaemon();
      const result = await daemon.sendRequest("status", { instanceId: id });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "workflow.context",
    "Get workflow instance XState context",
    {
      instanceId: z.string().optional().describe("Instance ID (defaults to WFE_INSTANCE_ID env)"),
    },
    async ({ instanceId }) => {
      const id = resolveInstanceId(instanceId);
      if (!id) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No instance context available." }),
            },
          ],
        };
      }

      const daemon = await getDaemon();
      const result = await daemon.sendRequest("context", { instanceId: id });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "workflow.setBrowserUrl",
    "Store a URL in the workflow instance context for browser pane",
    {
      url: z.string().describe("URL to store"),
      paneRole: z.string().optional().describe("Optional pane role"),
      instanceId: z.string().optional().describe("Instance ID (defaults to WFE_INSTANCE_ID env)"),
    },
    async ({ url, paneRole, instanceId }) => {
      const id = resolveInstanceId(instanceId);
      if (!id) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No instance context available." }),
            },
          ],
        };
      }

      const daemon = await getDaemon();
      const result = await daemon.sendRequest("setBrowserUrl", {
        instanceId: id,
        url,
        paneRole,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch(console.error);
}

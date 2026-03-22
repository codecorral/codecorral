import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";
import { log } from "./logger.js";
import {
  loadEmbeddedDefinitions,
} from "../actors/definition-registry.js";
import {
  rehydrateInstances,
  persistAllActors,
  stopAllActors,
  sendEvent,
  getActor,
  getAllActors,
  createWorkflowActor,
  generateInstanceId,
  getStateValue,
} from "../actors/actor-registry.js";
import { ensureDirectories } from "../persistence/snapshots.js";
import { loadConfig } from "../config/loader.js";

const CODECORRAL_DIR = path.join(os.homedir(), ".codecorral");
const SOCKET_PATH = path.join(CODECORRAL_DIR, "daemon.sock");
const PID_PATH = path.join(CODECORRAL_DIR, "daemon.pid");

let server: net.Server | null = null;
const connections: MessageConnection[] = [];

export function getSocketPath(): string {
  return SOCKET_PATH;
}

export function getPidPath(): string {
  return PID_PATH;
}

export async function startDaemon(foreground: boolean = false): Promise<void> {
  ensureDirectories();
  fs.mkdirSync(CODECORRAL_DIR, { recursive: true });

  // Clean stale socket
  if (fs.existsSync(SOCKET_PATH)) {
    try {
      const testSocket = net.createConnection(SOCKET_PATH);
      await new Promise<void>((resolve, reject) => {
        testSocket.on("connect", () => {
          testSocket.destroy();
          reject(new Error("Daemon already running"));
        });
        testSocket.on("error", () => {
          // Socket stale, remove it
          try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
          resolve();
        });
      });
    } catch (err) {
      if ((err as Error).message === "Daemon already running") {
        throw err;
      }
    }
  }

  loadEmbeddedDefinitions();
  const rehydrated = rehydrateInstances();
  log(`Daemon starting (PID: ${process.pid}, rehydrated: ${rehydrated} instances)`);

  // Write PID file
  fs.writeFileSync(PID_PATH, `${process.pid}\n`);

  server = net.createServer((socket) => {
    const reader = new StreamMessageReader(socket);
    const writer = new StreamMessageWriter(socket);
    const connection = createMessageConnection(reader, writer);

    registerHandlers(connection);
    connection.listen();
    connections.push(connection);

    socket.on("close", () => {
      const idx = connections.indexOf(connection);
      if (idx >= 0) connections.splice(idx, 1);
    });

    socket.on("error", () => {
      // Client disconnected
    });
  });

  server.listen(SOCKET_PATH, () => {
    log(`Daemon listening on ${SOCKET_PATH}`);
  });

  server.on("error", (err) => {
    log(`Server error: ${err.message}`);
  });

  const shutdown = () => {
    log("Daemon shutting down...");
    persistAllActors();
    stopAllActors();

    for (const conn of connections) {
      conn.dispose();
    }

    if (server) {
      server.close();
      server = null;
    }

    try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(PID_PATH); } catch { /* ignore */ }

    log("Daemon stopped");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  if (!foreground) {
    // Already running as detached child — keep alive
  }
}

function registerHandlers(connection: MessageConnection): void {
  connection.onRequest("status", (params: { instanceId?: string } | undefined) => {
    if (params?.instanceId) {
      const entry = getActor(params.instanceId);
      if (!entry) {
        return { error: `Instance not found: ${params.instanceId}` };
      }
      const snapshot = entry.actor.getSnapshot();
      const state = getStateValue(entry.actor);

      // Get available transitions via can()
      const availableTransitions: Array<{ event: string; canFire: boolean }> = [];
      const possibleEvents = ["start", "submit", "review.approved", "review.revised"];
      for (const evt of possibleEvents) {
        availableTransitions.push({
          event: evt,
          canFire: snapshot.can({ type: evt }),
        });
      }

      return {
        instanceId: entry.instanceId,
        definitionId: entry.definitionId,
        currentState: state,
        phase: null,
        context: snapshot.context,
        availableTransitions: availableTransitions.filter((t) => t.canFire),
      };
    }

    // List all active actors
    const actors = getAllActors();
    const instances = Array.from(actors.entries()).map(([id, entry]) => ({
      instanceId: id,
      definitionId: entry.definitionId,
      currentState: getStateValue(entry.actor),
      updatedAt: new Date().toISOString(),
    }));
    return { instances };
  });

  connection.onRequest("history", (params: { instanceId: string }) => {
    const entry = getActor(params.instanceId);
    if (!entry) {
      return { error: `Instance not found: ${params.instanceId}` };
    }
    return { history: [...entry.history].reverse() };
  });

  connection.onRequest(
    "transition",
    (params: {
      instanceId?: string;
      definitionId?: string;
      event: string;
      payload?: Record<string, unknown>;
    }) => {
      let { instanceId } = params;

      // If no instance exists and definitionId provided, create one
      if (instanceId && !getActor(instanceId) && params.definitionId) {
        try {
          createWorkflowActor(instanceId, params.definitionId);
        } catch (err) {
          return {
            accepted: false,
            newState: null,
            phase: null,
            message: (err as Error).message,
          };
        }
      } else if (instanceId && !getActor(instanceId) && !params.definitionId) {
        return {
          accepted: false,
          newState: null,
          phase: null,
          message: `Instance not found: ${instanceId}. Provide --definition to create it.`,
        };
      } else if (!instanceId) {
        if (!params.definitionId) {
          return {
            accepted: false,
            newState: null,
            phase: null,
            message: "No instance ID provided. Use --instance <id>.",
          };
        }
        instanceId = generateInstanceId(params.definitionId);
        try {
          createWorkflowActor(instanceId, params.definitionId);
        } catch (err) {
          return {
            accepted: false,
            newState: null,
            phase: null,
            message: (err as Error).message,
          };
        }
      }

      return sendEvent(instanceId, params.event, params.payload);
    },
  );

  connection.onRequest("workspaces", () => {
    const config = loadConfig();
    return { workspaces: config.workspaces };
  });

  connection.onRequest("daemon.status", () => {
    const actors = getAllActors();
    return {
      running: true,
      pid: process.pid,
      uptime: process.uptime(),
      activeInstances: actors.size,
    };
  });

  connection.onRequest("daemon.stop", () => {
    log("Received stop request");
    setTimeout(() => process.kill(process.pid, "SIGTERM"), 100);
    return { ok: true };
  });

  // Context request for MCP
  connection.onRequest("context", (params: { instanceId: string }) => {
    const entry = getActor(params.instanceId);
    if (!entry) {
      return { error: `Instance not found: ${params.instanceId}` };
    }
    return { context: entry.actor.getSnapshot().context };
  });

  // setBrowserUrl for MCP
  connection.onRequest(
    "setBrowserUrl",
    (params: { instanceId: string; url: string; paneRole?: string }) => {
      const entry = getActor(params.instanceId);
      if (!entry) {
        return { error: `Instance not found: ${params.instanceId}` };
      }
      // Store URL directly in the actor context by sending a special internal event
      // For test-v0.1, we store it in the persisted instance metadata
      const snapshot = entry.actor.getSnapshot();
      const ctx = snapshot.context as Record<string, unknown>;
      ctx.browserUrl = params.url;
      return { ok: true, browserUrl: params.url };
    },
  );
}

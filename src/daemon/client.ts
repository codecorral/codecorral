import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";

const CODECORRAL_DIR = path.join(os.homedir(), ".codecorral");
const SOCKET_PATH = path.join(CODECORRAL_DIR, "daemon.sock");
const PID_PATH = path.join(CODECORRAL_DIR, "daemon.pid");

export function getSocketPath(): string {
  return SOCKET_PATH;
}

export async function isDaemonRunning(): Promise<boolean> {
  if (!fs.existsSync(SOCKET_PATH)) return false;

  return new Promise((resolve) => {
    const socket = net.createConnection(SOCKET_PATH);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
    setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);
  });
}

export async function connectToDaemon(): Promise<MessageConnection> {
  const socket = net.createConnection(SOCKET_PATH);

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("error", reject);
  });

  const reader = new StreamMessageReader(socket);
  const writer = new StreamMessageWriter(socket);
  const connection = createMessageConnection(reader, writer);
  connection.listen();
  return connection;
}

export async function ensureDaemon(): Promise<MessageConnection> {
  // Check if daemon is running
  if (await isDaemonRunning()) {
    return connectToDaemon();
  }

  // Stale socket cleanup
  if (fs.existsSync(SOCKET_PATH)) {
    try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
  }

  // Start daemon
  await spawnDaemon();

  // Wait for socket
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (fs.existsSync(SOCKET_PATH)) {
      try {
        return await connectToDaemon();
      } catch {
        // Not ready yet
      }
    }
  }

  throw new Error("Failed to start daemon — socket not available after 5s");
}

async function spawnDaemon(): Promise<void> {
  const binPath = process.argv[1];
  const child = spawn(process.execPath, [binPath, "daemon", "start", "--foreground"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
}

export function isRunningViaNpx(): boolean {
  const execPath = process.argv[1] ?? "";
  return execPath.includes("npx") || execPath.includes(".npm/_npx");
}

export function getDaemonPid(): number | null {
  try {
    const content = fs.readFileSync(PID_PATH, "utf-8").trim();
    return parseInt(content, 10);
  } catch {
    return null;
  }
}

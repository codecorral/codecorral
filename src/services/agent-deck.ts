import { spawn } from "node:child_process";
import { fromPromise } from "xstate";

// --- Types ---

export interface AgentDeckError {
  exitCode: number;
  stderr: string;
  command: string;
  code?: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SessionRef {
  title: string;
  status: string;
}

export interface SessionInfo {
  title: string;
  status: string;
  path?: string;
  tool?: string;
  group?: string;
  mcps?: string[];
  parent?: string;
  worktree?: { branch?: string; location?: string };
}

export interface SessionListEntry {
  title: string;
  status: string;
  path?: string;
  tool?: string;
  group?: string;
}

export interface CreateSessionInput {
  workPath: string;
  title: string;
  tool?: string;
  parentSession?: string;
  branch?: string;
  newBranch?: boolean;
  location?: string;
  mcpServers?: string[];
  initialMessage?: string;
  group?: string;
}

export interface SendMessageInput {
  title: string;
  message: string;
}

export interface StopSessionInput {
  title: string;
  recursive?: boolean;
  prefix?: string;
}

export interface RemoveSessionInput {
  title: string;
}

export interface ShowSessionInput {
  title: string;
}

export interface AttachMcpInput {
  title: string;
  mcpName: string;
}

export interface SetParentInput {
  child: string;
  parent: string;
}

export interface ListSessionsInput {
  prefix?: string;
}

export interface GetOutputInput {
  title: string;
}

// --- Shared exec helper ---

function parseErrorCode(stderr: string): string | undefined {
  try {
    const parsed = JSON.parse(stderr);
    if (parsed && typeof parsed.code === "string") {
      return parsed.code;
    }
  } catch {
    // Not JSON — no semantic code
  }
  return undefined;
}

export function execAgentDeck(
  args: string[],
  timeoutMs: number = 30_000,
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const command = `agent-deck ${args.join(" ")}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    const child = spawn("agent-deck", args, {
      signal: ac.signal,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.name === "AbortError" || ac.signal.aborted) {
        const error: AgentDeckError = {
          exitCode: -1,
          stderr: "timeout",
          command,
        };
        reject(error);
      } else {
        const error: AgentDeckError = {
          exitCode: -1,
          stderr: err.message,
          command,
        };
        reject(error);
      }
    });

    child.on("close", (exitCode: number | null) => {
      clearTimeout(timer);
      const code = exitCode ?? 1;
      if (code === 0) {
        resolve({ exitCode: 0, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const error: AgentDeckError = {
          exitCode: code,
          stderr: stderr.trim(),
          command,
          code: parseErrorCode(stderr.trim()),
        };
        reject(error);
      }
    });
  });
}

// --- Service Actors ---

export const createSessionActor = fromPromise(
  async ({ input }: { input: CreateSessionInput }): Promise<SessionRef> => {
    const args: string[] = ["launch", input.workPath];
    args.push("-t", input.title);
    args.push("-c", input.tool ?? "claude");
    if (input.parentSession) args.push("-p", input.parentSession);
    if (input.branch) args.push("-w", input.branch);
    if (input.newBranch) args.push("-b");
    if (input.location) args.push("--location", input.location);
    if (input.mcpServers) {
      for (const mcp of input.mcpServers) {
        args.push("--mcp", mcp);
      }
    }
    if (input.group) args.push("-g", input.group);
    if (input.initialMessage) args.push("-m", input.initialMessage);
    args.push("--json");

    const result = await execAgentDeck(args, 60_000);
    try {
      return JSON.parse(result.stdout) as SessionRef;
    } catch {
      return { title: input.title, status: "running" };
    }
  },
);

export const sendMessageActor = fromPromise(
  async ({ input }: { input: SendMessageInput }): Promise<void> => {
    await execAgentDeck(
      ["session", "send", input.title, input.message, "--json"],
      30_000,
    );
  },
);

export const stopSessionActor = fromPromise(
  async ({ input }: { input: StopSessionInput }): Promise<void> => {
    if (input.recursive && input.prefix) {
      const { stopSessionTree } = await import("./session-lifecycle.js");
      await stopSessionTree(input.title, input.prefix);
      return;
    }
    try {
      await execAgentDeck(["session", "stop", input.title], 10_000);
    } catch (err) {
      const adErr = err as AgentDeckError;
      if (adErr.exitCode === 2) return; // idempotent — already gone
      throw err;
    }
  },
);

export const removeSessionActor = fromPromise(
  async ({ input }: { input: RemoveSessionInput }): Promise<void> => {
    await execAgentDeck(["remove", input.title], 10_000);
  },
);

export const showSessionActor = fromPromise(
  async ({ input }: { input: ShowSessionInput }): Promise<SessionInfo> => {
    const result = await execAgentDeck(
      ["session", "show", input.title, "--json"],
      5_000,
    );
    return JSON.parse(result.stdout) as SessionInfo;
  },
);

export const attachMcpActor = fromPromise(
  async ({ input }: { input: AttachMcpInput }): Promise<void> => {
    await execAgentDeck(
      ["mcp", "attach", input.title, input.mcpName],
      10_000,
    );
    await execAgentDeck(["session", "restart", input.title], 10_000);
  },
);

export const setParentActor = fromPromise(
  async ({ input }: { input: SetParentInput }): Promise<void> => {
    await execAgentDeck(
      ["session", "set-parent", input.child, input.parent],
      5_000,
    );
  },
);

export const listSessionsActor = fromPromise(
  async ({
    input,
  }: {
    input: ListSessionsInput;
  }): Promise<SessionListEntry[]> => {
    const result = await execAgentDeck(["list", "--json"], 10_000);
    const sessions = JSON.parse(result.stdout) as SessionListEntry[];
    if (input.prefix) {
      return sessions.filter((s) => s.title.startsWith(input.prefix!));
    }
    return sessions;
  },
);

export const getOutputActor = fromPromise(
  async ({ input }: { input: GetOutputInput }): Promise<string> => {
    const result = await execAgentDeck(
      ["session", "output", input.title, "--json"],
      5_000,
    );
    try {
      const parsed = JSON.parse(result.stdout);
      return typeof parsed === "string"
        ? parsed
        : (parsed.text ?? parsed.output ?? result.stdout);
    } catch {
      return result.stdout;
    }
  },
);

import {
  execAgentDeck,
  type AgentDeckError,
  type SessionInfo,
  type SessionListEntry,
} from "./agent-deck.js";
import { getSessionPrefix } from "./session-naming.js";

export async function stopSessionTree(
  title: string,
  prefix: string,
): Promise<void> {
  // List all sessions matching the workflow prefix
  let sessions: SessionListEntry[] = [];
  try {
    const result = await execAgentDeck(["list", "--json"], 10_000);
    sessions = (JSON.parse(result.stdout) as SessionListEntry[]).filter((s) =>
      s.title.startsWith(prefix),
    );
  } catch {
    // If list fails, just try to stop the target directly
    await stopSingle(title);
    return;
  }

  // Discover children by calling show on each session
  const children: string[] = [];
  for (const session of sessions) {
    if (session.title === title) continue;
    try {
      const result = await execAgentDeck(
        ["session", "show", session.title, "--json"],
        5_000,
      );
      const info = JSON.parse(result.stdout) as SessionInfo;
      if (info.parent === title) {
        children.push(session.title);
      }
    } catch {
      // Skip sessions we can't query
    }
  }

  // Depth-first: stop children first
  for (const child of children) {
    await stopSessionTree(child, prefix);
  }

  // Stop the target
  await stopSingle(title);
}

async function stopSingle(title: string): Promise<void> {
  try {
    await execAgentDeck(["session", "stop", title], 10_000);
  } catch (err) {
    const adErr = err as AgentDeckError;
    if (adErr.exitCode === 2) return; // idempotent — already gone
    throw err;
  }
}

export async function discoverWorkflowSessions(
  instanceId: string,
): Promise<SessionListEntry[]> {
  const prefix = getSessionPrefix(instanceId);
  const result = await execAgentDeck(["list", "--json"], 10_000);
  const sessions = JSON.parse(result.stdout) as SessionListEntry[];
  return sessions.filter((s) => s.title.startsWith(prefix));
}

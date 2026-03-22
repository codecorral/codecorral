import { createActor, type AnyActorRef, type Snapshot } from "xstate";
import type {
  ActorEntry,
  HistoryEntry,
  TransitionResult,
  PersistedWorkflowInstance,
} from "./types.js";
import { getDefinition, getMigration } from "./definition-registry.js";
import { persistInstance, getInstancesDir } from "../persistence/snapshots.js";
import { log } from "../daemon/logger.js";
import * as fs from "node:fs";
import * as path from "node:path";

const actors = new Map<string, ActorEntry>();
const MAX_HISTORY = 1000;

export function generateInstanceId(definitionId: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let shortId = "";
  for (let i = 0; i < 8; i++) {
    shortId += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${definitionId}-${shortId}`;
}

export function getActor(instanceId: string): ActorEntry | undefined {
  return actors.get(instanceId);
}

export function getAllActors(): Map<string, ActorEntry> {
  return actors;
}

export function createWorkflowActor(
  instanceId: string,
  definitionId: string,
  snapshot?: Snapshot<unknown>,
  existingHistory?: HistoryEntry[],
  existingTimestamps?: { createdAt: string; updatedAt: string },
): ActorEntry {
  const def = getDefinition(definitionId);
  if (!def) {
    throw new Error(`Definition not found: ${definitionId}`);
  }

  const actorOptions: Record<string, unknown> = { id: instanceId };
  if (snapshot) {
    actorOptions.snapshot = snapshot;
  }

  const actor = createActor(def.machine as Parameters<typeof createActor>[0], actorOptions);

  const now = new Date().toISOString();
  const entry: ActorEntry = {
    actor,
    definitionId,
    instanceId,
    schemaVersion: def.schemaVersion,
    history: existingHistory ?? [],
    createdAt: existingTimestamps?.createdAt ?? now,
  };

  let prevSnapshot: Snapshot<unknown> | null = null;

  actor.subscribe((snap) => {
    if (snap !== prevSnapshot) {
      prevSnapshot = snap;
      const instance: PersistedWorkflowInstance = {
        id: instanceId,
        definitionId,
        schemaVersion: entry.schemaVersion,
        xstateSnapshot: actor.getPersistedSnapshot() as Snapshot<unknown>,
        history: entry.history,
        timestamps: {
          createdAt: entry.createdAt,
          updatedAt: new Date().toISOString(),
        },
      };
      persistInstance(instance);
    }
  });

  actor.start();
  actors.set(instanceId, entry);
  return entry;
}

export function sendEvent(
  instanceId: string,
  event: string,
  payload?: Record<string, unknown>,
): TransitionResult {
  const entry = actors.get(instanceId);
  if (!entry) {
    return {
      accepted: false,
      newState: null,
      phase: null,
      message: `Instance not found: ${instanceId}`,
    };
  }

  const stateBefore = getStateValue(entry.actor);
  const xstateEvent = payload
    ? { type: event, ...payload }
    : { type: event };

  entry.actor.send(xstateEvent);

  const stateAfter = getStateValue(entry.actor);
  const accepted = stateBefore !== stateAfter;

  const historyEntry: HistoryEntry = {
    event,
    payload,
    timestamp: new Date().toISOString(),
    accepted,
  };

  if (accepted) {
    historyEntry.fromState = stateBefore;
    historyEntry.toState = stateAfter;
  } else {
    historyEntry.state = stateBefore;
  }

  entry.history.push(historyEntry);
  if (entry.history.length > MAX_HISTORY) {
    entry.history.splice(0, entry.history.length - MAX_HISTORY);
  }

  // Re-persist with updated history — subscribe callback fires before history
  // is appended, so we always re-persist to include the latest history entry
  {
    const instance: PersistedWorkflowInstance = {
      id: instanceId,
      definitionId: entry.definitionId,
      schemaVersion: entry.schemaVersion,
      xstateSnapshot: entry.actor.getPersistedSnapshot() as Snapshot<unknown>,
      history: entry.history,
      timestamps: {
        createdAt: entry.createdAt,
        updatedAt: new Date().toISOString(),
      },
    };
    persistInstance(instance);
  }

  const message = accepted
    ? `Transitioned from '${stateBefore}' to '${stateAfter}' via '${event}'`
    : `No transition for event '${event}' in state '${stateBefore}'`;

  log(
    `Event '${event}' on ${instanceId}: ${accepted ? "accepted" : "rejected"} → ${stateAfter}`,
  );

  return {
    accepted,
    newState: accepted ? stateAfter : null,
    phase: null,
    message,
  };
}

export function getStateValue(actor: AnyActorRef): string {
  const snapshot = actor.getSnapshot();
  const value = snapshot.value;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function rehydrateInstances(): number {
  const dir = getInstancesDir();
  if (!fs.existsSync(dir)) return 0;

  // Clean orphaned tmp files
  const tmpFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json.tmp"));
  for (const tmp of tmpFiles) {
    try {
      fs.unlinkSync(path.join(dir, tmp));
      log(`Deleted orphaned tmp file: ${tmp}`);
    } catch {
      // File may have been removed between readdir and unlink
    }
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let count = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const data = JSON.parse(
        fs.readFileSync(filePath, "utf-8"),
      ) as PersistedWorkflowInstance;

      // Skip completed instances
      const snapshot = data.xstateSnapshot as Record<string, unknown>;
      if (snapshot.status === "done") {
        log(`Skipping completed instance: ${data.id}`);
        continue;
      }

      const def = getDefinition(data.definitionId);
      if (!def) {
        log(`Warning: Unknown definition '${data.definitionId}' for instance ${data.id}, skipping`);
        continue;
      }

      // Check schema version
      if (data.schemaVersion !== def.schemaVersion) {
        const migration = getMigration(data.schemaVersion, def.schemaVersion);
        if (migration) {
          data.xstateSnapshot = migration(data.xstateSnapshot);
          log(`Migrated instance ${data.id} from ${data.schemaVersion} to ${def.schemaVersion}`);
        } else {
          log(
            `Warning: Schema version mismatch for ${data.id} (persisted: ${data.schemaVersion}, current: ${def.schemaVersion}), no migration registered, skipping`,
          );
          continue;
        }
      }

      createWorkflowActor(
        data.id,
        data.definitionId,
        data.xstateSnapshot,
        data.history,
        data.timestamps,
      );
      count++;
      log(`Rehydrated instance: ${data.id} (state: ${getStateValue(actors.get(data.id)!.actor)})`);
    } catch (err) {
      log(`Warning: Failed to rehydrate ${file}: ${err}`);
    }
  }

  return count;
}

export function persistAllActors(): void {
  for (const [instanceId, entry] of actors) {
    const instance: PersistedWorkflowInstance = {
      id: instanceId,
      definitionId: entry.definitionId,
      schemaVersion: entry.schemaVersion,
      xstateSnapshot: entry.actor.getPersistedSnapshot() as Snapshot<unknown>,
      history: entry.history,
      timestamps: {
        createdAt: entry.createdAt,
        updatedAt: new Date().toISOString(),
      },
    };
    persistInstance(instance);
  }
}

export function stopAllActors(): void {
  for (const [, entry] of actors) {
    entry.actor.stop();
  }
}

export function clearActors(): void {
  stopAllActors();
  actors.clear();
}

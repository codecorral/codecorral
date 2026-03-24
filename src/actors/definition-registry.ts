import type { Snapshot } from "xstate";
import type { DefinitionEntry, MigrationFn } from "./types.js";
import { testWorkflowV01 } from "./test-workflow.js";
import { testWorkflowV02 } from "./test-workflow-v02.js";

const definitions = new Map<string, DefinitionEntry>();
const migrations = new Map<string, MigrationFn>();

export function registerDefinition(
  id: string,
  entry: DefinitionEntry,
): void {
  definitions.set(id, entry);
}

export function getDefinition(id: string): DefinitionEntry | undefined {
  return definitions.get(id);
}

export function hasDefinition(id: string): boolean {
  return definitions.has(id);
}

export function getAllDefinitionIds(): string[] {
  return Array.from(definitions.keys());
}

export function registerMigration(
  fromVersion: string,
  toVersion: string,
  fn: MigrationFn,
): void {
  migrations.set(`${fromVersion}->${toVersion}`, fn);
}

export function getMigration(
  fromVersion: string,
  toVersion: string,
): MigrationFn | undefined {
  return migrations.get(`${fromVersion}->${toVersion}`);
}

export function loadEmbeddedDefinitions(): void {
  registerDefinition("test-v0.1", {
    machine: testWorkflowV01,
    schemaVersion: "test-v0.1",
  });

  registerDefinition("test-v0.2", {
    machine: testWorkflowV02,
    schemaVersion: "test-v0.2",
  });

  // Migration: test-v0.1 → test-v0.2
  registerMigration("test-v0.1", "test-v0.2", (snapshot: Snapshot<unknown>) => {
    const snap = snapshot as Record<string, unknown>;
    const stateMap: Record<string, string> = {
      idle: "idle",
      working: "agent_working",
      reviewing: "agent_working",
      done: "done",
    };
    const currentState = snap.value as string;
    const mappedState = stateMap[currentState] ?? currentState;

    const existingContext = (snap.context ?? {}) as Record<string, unknown>;
    return {
      ...snap,
      value: mappedState,
      context: {
        ...existingContext,
        sessionTitle: null,
        sessionError: null,
      },
    } as unknown as Snapshot<unknown>;
  });
}

export function clearDefinitions(): void {
  definitions.clear();
}

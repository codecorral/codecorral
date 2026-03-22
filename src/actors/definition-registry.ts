import type { DefinitionEntry, MigrationFn } from "./types.js";
import { testWorkflowV01 } from "./test-workflow.js";

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
}

export function clearDefinitions(): void {
  definitions.clear();
}

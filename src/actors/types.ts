import type { AnyActorRef, Snapshot } from "xstate";

export interface TransitionResult {
  accepted: boolean;
  newState: string | null;
  phase: string | null;
  message: string;
}

export interface HistoryEntry {
  event: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  accepted: boolean;
  fromState?: string;
  toState?: string;
  state?: string;
}

export interface PersistedWorkflowInstance {
  id: string;
  definitionId: string;
  schemaVersion: string;
  xstateSnapshot: Snapshot<unknown>;
  history: HistoryEntry[];
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface ProjectConfig {
  path: string;
  workflows?: string[];
  agent_deck_profile?: string;
  openspec_schemas_path?: string;
}

export interface CodeCorralConfig {
  projects: Record<string, ProjectConfig>;
}

export type MigrationFn = (snapshot: Snapshot<unknown>) => Snapshot<unknown>;

export interface DefinitionEntry {
  machine: Parameters<typeof import("xstate").createActor>[0];
  schemaVersion: string;
}

export interface ActorEntry {
  actor: AnyActorRef;
  definitionId: string;
  instanceId: string;
  schemaVersion: string;
  history: HistoryEntry[];
  createdAt: string;
}

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

export interface WorkspaceConfig {
  path: string;
  workflows?: string[];
  agentDeckProfile?: string;
  claudeCodeProfile?: string;
  agentDeck?: {
    profile?: string;
  };
  claudeCode?: {
    model?: string;
    apiKey?: string;
  };
  openspec?: {
    schemas?: string[];
    schemasPath?: string;
    config?: Record<string, unknown>;
  };
}

export interface CodeCorralConfig {
  workspaces: Record<string, WorkspaceConfig>;
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

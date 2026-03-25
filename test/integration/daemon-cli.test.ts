import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createWorkflowActor,
  sendEvent,
  clearActors,
  getStateValue,
  getActor,
} from "../../src/actors/actor-registry.js";
import {
  loadEmbeddedDefinitions,
  clearDefinitions,
} from "../../src/actors/definition-registry.js";
import {
  readInstance,
  readAllInstances,
  persistInstance,
  deleteInstance,
  ensureDirectories,
  getInstancesDir,
} from "../../src/persistence/snapshots.js";
import { loadConfig } from "../../src/config/loader.js";
import type { PersistedWorkflowInstance } from "../../src/actors/types.js";

describe("integration: client-only CLI reads", () => {
  beforeEach(() => {
    clearActors();
    clearDefinitions();
    loadEmbeddedDefinitions();
    ensureDirectories();
  });

  afterEach(() => {
    clearActors();
    deleteInstance("cli-read-1");
    deleteInstance("cli-read-2");
  });

  it("should read status from persisted files without daemon (client-only)", () => {
    // Create and persist instances directly (simulating daemon-written files)
    createWorkflowActor("cli-read-1", "test-v0.1");
    sendEvent("cli-read-1", "start");

    // Clear actors to simulate no daemon
    clearActors();

    // Read directly from files (what CLI status command does)
    const instances = readAllInstances();
    const found = instances.find((i) => i.id === "cli-read-1");
    expect(found).toBeDefined();
    expect(found!.definitionId).toBe("test-v0.1");
    const snapshot = found!.xstateSnapshot as Record<string, unknown>;
    expect(snapshot.value).toBe("working");
  });

  it("should read history from persisted files without daemon", () => {
    createWorkflowActor("cli-read-2", "test-v0.1");
    sendEvent("cli-read-2", "start");
    sendEvent("cli-read-2", "submit");
    clearActors();

    // Read instance file directly (what CLI history command does)
    const instance = readInstance("cli-read-2");
    expect(instance).not.toBeNull();
    expect(instance!.history.length).toBeGreaterThanOrEqual(2);

    // Reverse chronological
    const reversed = [...instance!.history].reverse();
    expect(reversed[0].event).toBe("submit");
    expect(reversed[1].event).toBe("start");
  });

  it("should handle ENOENT gracefully when file deleted between readdir and readFile", () => {
    // Persist then delete to simulate race
    const instance: PersistedWorkflowInstance = {
      id: "cli-read-1",
      definitionId: "test-v0.1",
      schemaVersion: "test-v0.1",
      xstateSnapshot: { value: "idle", status: "active" } as unknown as import("xstate").Snapshot<unknown>,
      history: [],
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    persistInstance(instance);
    deleteInstance("cli-read-1");

    // Reading should return null, not throw
    const read = readInstance("cli-read-1");
    expect(read).toBeNull();
  });

  it("should read projects from config.yaml without daemon", () => {
    const configDir = path.join(os.homedir(), ".codecorral");
    const configPath = path.join(configDir, "config.yaml");
    let originalContent: string | null = null;
    try {
      originalContent = fs.readFileSync(configPath, "utf-8");
    } catch { /* doesn't exist */ }

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, `projects:
  test-proj:
    path: /tmp/test-proj
    workflows:
      - intent
    agent_deck_profile: test-proj
`);

    const config = loadConfig();
    expect(config.projects["test-proj"]).toBeDefined();
    expect(config.projects["test-proj"].path).toBe("/tmp/test-proj");
    expect(config.projects["test-proj"].agent_deck_profile).toBe("test-proj");

    // Restore
    if (originalContent !== null) {
      fs.writeFileSync(configPath, originalContent);
    } else {
      try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    }
  });
});

describe("integration: config merging", () => {
  it("should merge user and project configs with project precedence", () => {
    const configDir = path.join(os.homedir(), ".codecorral");
    const configPath = path.join(configDir, "config.yaml");
    let originalContent: string | null = null;
    try {
      originalContent = fs.readFileSync(configPath, "utf-8");
    } catch { /* doesn't exist */ }

    // Write user config
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, `projects:
  merge-test:
    path: /tmp/merge-test
    workflows:
      - intent
    agent_deck_profile: user-profile
`);

    // Create project config dir
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-"));
    const projectConfigDir = path.join(projectDir, ".codecorral");
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(path.join(projectConfigDir, "config.yaml"), `projects:
  merge-test:
    path: /tmp/merge-test-override
    workflows:
      - unit
`);

    const config = loadConfig(projectDir);
    // Project path should override user
    expect(config.projects["merge-test"].path).toBe("/tmp/merge-test-override");
    expect(config.projects["merge-test"].workflows).toEqual(["unit"]);

    // Restore
    if (originalContent !== null) {
      fs.writeFileSync(configPath, originalContent);
    } else {
      try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    }
    fs.rmSync(projectDir, { recursive: true });
  });
});

describe("integration: stale socket recovery", () => {
  it("should detect stale socket (file exists but not connectable)", async () => {
    const socketPath = path.join(os.homedir(), ".codecorral", "daemon.sock");

    // Create a regular file at socket path to simulate stale socket
    const existed = fs.existsSync(socketPath);
    if (!existed) {
      fs.mkdirSync(path.dirname(socketPath), { recursive: true });
      fs.writeFileSync(socketPath, "stale");
    }

    // isDaemonRunning should return false for a non-socket file
    const { isDaemonRunning } = await import("../../src/daemon/client.js");
    const running = await isDaemonRunning();

    // Clean up the fake socket file only if we created it
    if (!existed) {
      try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
    }

    // A stale/non-socket file should not be considered "running"
    expect(running).toBe(false);
  });
});

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { PersistedWorkflowInstance } from "../actors/types.js";

const CODECORRAL_DIR = path.join(os.homedir(), ".codecorral");
const INSTANCES_DIR = path.join(CODECORRAL_DIR, "instances");

export function getCodeCorralDir(): string {
  return CODECORRAL_DIR;
}

export function getInstancesDir(): string {
  return INSTANCES_DIR;
}

export function ensureDirectories(): void {
  fs.mkdirSync(INSTANCES_DIR, { recursive: true });
}

export function persistInstance(instance: PersistedWorkflowInstance): void {
  ensureDirectories();
  const filePath = path.join(INSTANCES_DIR, `${instance.id}.json`);
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(instance, null, 2));
    fs.renameSync(tmpPath, filePath);
  } catch {
    // Best-effort persistence — tmp may have been cleaned by another process
  }
}

export function readInstance(
  instanceId: string,
): PersistedWorkflowInstance | null {
  const filePath = path.join(INSTANCES_DIR, `${instanceId}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function readAllInstances(): PersistedWorkflowInstance[] {
  ensureDirectories();
  const files = fs.readdirSync(INSTANCES_DIR).filter((f) => f.endsWith(".json"));
  const instances: PersistedWorkflowInstance[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(INSTANCES_DIR, file), "utf-8"),
      );
      instances.push(data);
    } catch {
      // Skip corrupted or deleted files (ENOENT race)
    }
  }
  return instances;
}

export function deleteInstance(instanceId: string): boolean {
  const filePath = path.join(INSTANCES_DIR, `${instanceId}.json`);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

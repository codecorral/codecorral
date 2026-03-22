import { Command } from "commander";
import { readAllInstances, readInstance } from "../../persistence/snapshots.js";
import type { PersistedWorkflowInstance } from "../../actors/types.js";

export function statusCommand(): Command {
  const cmd = new Command("status")
    .description("Show workflow instance status")
    .argument("[id]", "Instance ID for detailed status")
    .action(async (id?: string) => {
      if (id) {
        showInstanceStatus(id);
      } else {
        listAllInstances();
      }
    });

  return cmd;
}

function showInstanceStatus(id: string): void {
  const instance = readInstance(id);
  if (!instance) {
    console.error(`Instance not found: ${id}`);
    process.exitCode = 1;
    return;
  }

  const snapshot = instance.xstateSnapshot as Record<string, unknown>;
  const state = typeof snapshot.value === "string" ? snapshot.value : JSON.stringify(snapshot.value);
  const ctx = snapshot.context as Record<string, unknown>;

  console.log(`Instance:    ${instance.id}`);
  console.log(`Definition:  ${instance.definitionId}`);
  console.log(`State:       ${state}`);
  console.log(`Version:     ${instance.schemaVersion}`);
  console.log(`Created:     ${instance.timestamps.createdAt}`);
  console.log(`Updated:     ${instance.timestamps.updatedAt}`);
  console.log(`Context:     ${JSON.stringify(ctx, null, 2)}`);
}

function listAllInstances(): void {
  const instances = readAllInstances();

  if (instances.length === 0) {
    console.log("No active workflow instances");
    return;
  }

  // Table output
  const header = `${"ID".padEnd(35)} ${"Definition".padEnd(15)} ${"State".padEnd(12)} ${"Updated".padEnd(25)}`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (const inst of instances) {
    const snapshot = inst.xstateSnapshot as Record<string, unknown>;
    const state = typeof snapshot.value === "string"
      ? snapshot.value
      : JSON.stringify(snapshot.value);
    const id = inst.id.padEnd(35);
    const def = inst.definitionId.padEnd(15);
    const st = state.padEnd(12);
    const updated = inst.timestamps.updatedAt.substring(0, 24);
    console.log(`${id} ${def} ${st} ${updated}`);
  }
}

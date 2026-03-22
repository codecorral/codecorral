import { Command } from "commander";
import { readInstance } from "../../persistence/snapshots.js";

export function historyCommand(): Command {
  return new Command("history")
    .description("Show event history for a workflow instance")
    .argument("<id>", "Instance ID")
    .action(async (id: string) => {
      const instance = readInstance(id);
      if (!instance) {
        console.error(`Instance not found: ${id}`);
        process.exitCode = 1;
        return;
      }

      if (instance.history.length === 0) {
        console.log(`No history for instance ${id}`);
        return;
      }

      // Reverse chronological
      const entries = [...instance.history].reverse();

      for (const entry of entries) {
        const status = entry.accepted ? "accepted" : "rejected";
        const transition = entry.accepted
          ? `${entry.fromState} -> ${entry.toState}`
          : `(stayed in ${entry.state})`;
        console.log(
          `[${entry.timestamp}] ${entry.event} — ${status} ${transition}`,
        );
      }
    });
}

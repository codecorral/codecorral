import { Command } from "commander";
import { readAllInstances, deleteInstance } from "../../persistence/snapshots.js";

export function gcCommand(): Command {
  return new Command("gc")
    .description("Remove completed instances older than threshold")
    .option("--older-than <duration>", "Duration threshold (e.g., 30d)", "30d")
    .action(async (opts: { olderThan: string }) => {
      const thresholdMs = parseDuration(opts.olderThan);
      if (thresholdMs === null) {
        console.error(`Invalid duration: ${opts.olderThan}`);
        process.exitCode = 1;
        return;
      }

      const cutoff = new Date(Date.now() - thresholdMs);
      const instances = readAllInstances();
      let removed = 0;

      for (const inst of instances) {
        const snapshot = inst.xstateSnapshot as Record<string, unknown>;
        if (snapshot.status !== "done") continue;

        const updated = new Date(inst.timestamps.updatedAt);
        if (updated < cutoff) {
          deleteInstance(inst.id);
          removed++;
        }
      }

      console.log(`Removed ${removed} completed instance(s)`);
    });
}

function parseDuration(s: string): number | null {
  const match = s.match(/^(\d+)([dhms])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] ?? 0);
}

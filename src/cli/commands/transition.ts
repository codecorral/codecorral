import { Command } from "commander";
import { ensureDaemon, isRunningViaNpx } from "../../daemon/client.js";

export function transitionCommand(): Command {
  return new Command("transition")
    .description("Fire a transition on a workflow instance")
    .argument("<event>", "Event name (e.g., start, submit, review.approved)")
    .requiredOption("--instance <id>", "Instance ID")
    .option("--definition <defId>", "Definition ID (for creating new instances)")
    .option("--payload <json>", "JSON payload for the event")
    .action(async (event: string, opts: {
      instance: string;
      definition?: string;
      payload?: string;
    }) => {
      if (isRunningViaNpx()) {
        console.warn(
          "Warning: Running via npx — daemon may not persist across npx cache updates. Consider `npm install -g codecorral` for daemon usage.",
        );
      }

      let payload: Record<string, unknown> | undefined;
      if (opts.payload) {
        try {
          payload = JSON.parse(opts.payload);
        } catch {
          console.error("Invalid JSON payload");
          process.exitCode = 1;
          return;
        }
      }

      try {
        const connection = await ensureDaemon();
        const result = await connection.sendRequest("transition", {
          instanceId: opts.instance,
          definitionId: opts.definition,
          event,
          payload,
        });

        const r = result as {
          accepted: boolean;
          newState: string | null;
          message: string;
        };

        if (r.accepted) {
          console.log(`accepted — new state: ${r.newState}`);
        } else {
          console.log(`rejected — ${r.message}`);
          process.exitCode = 1;
        }

        connection.dispose();
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}

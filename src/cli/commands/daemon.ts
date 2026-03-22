import { Command } from "commander";
import { isDaemonRunning, connectToDaemon, getDaemonPid } from "../../daemon/client.js";
import { startDaemon } from "../../daemon/server.js";

export function daemonCommand(): Command {
  const cmd = new Command("daemon").description("Manage the engine daemon");

  cmd
    .command("start")
    .description("Start the daemon")
    .option("--foreground", "Run in the foreground")
    .action(async (opts: { foreground?: boolean }) => {
      try {
        await startDaemon(opts.foreground ?? false);
        if (opts.foreground) {
          // Keep alive — daemon runs until SIGTERM/SIGINT
        } else {
          console.log("Daemon started");
        }
      } catch (err) {
        if ((err as Error).message === "Daemon already running") {
          console.log("Daemon is already running");
        } else {
          console.error(`Failed to start daemon: ${(err as Error).message}`);
          process.exitCode = 1;
        }
      }
    });

  cmd
    .command("stop")
    .description("Stop the daemon")
    .action(async () => {
      if (!(await isDaemonRunning())) {
        console.log("Daemon is not running");
        return;
      }

      try {
        const connection = await connectToDaemon();
        await connection.sendRequest("daemon.stop");
        connection.dispose();
        console.log("Daemon stopping...");
      } catch (err) {
        console.error(`Failed to stop daemon: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command("status")
    .description("Show daemon status")
    .action(async () => {
      const running = await isDaemonRunning();
      if (!running) {
        console.log("Daemon is not running");
        return;
      }

      try {
        const connection = await connectToDaemon();
        const result = await connection.sendRequest("daemon.status") as {
          running: boolean;
          pid: number;
          uptime: number;
          activeInstances: number;
        };

        console.log(`Status:  running`);
        console.log(`PID:     ${result.pid}`);
        console.log(`Uptime:  ${Math.round(result.uptime)}s`);
        console.log(`Actors:  ${result.activeInstances}`);

        connection.dispose();
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const LOG_PATH = path.join(os.homedir(), ".codecorral", "daemon.log");

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    // Best-effort logging
  }
}

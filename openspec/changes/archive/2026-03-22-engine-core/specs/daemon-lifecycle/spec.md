## ADDED Requirements

### Requirement: Implicit process start
The engine daemon SHALL start automatically when needed — triggered by the first CLI command or MCP connection. No explicit `daemon start` command is required for normal usage.

#### Scenario: First CLI command starts daemon
- **WHEN** the user runs `codecorral status` and no daemon is running
- **THEN** the CLI spawns the daemon process in the background, waits for `~/.codecorral/daemon.sock` to become available, then executes the command

#### Scenario: MCP connection triggers daemon
- **WHEN** an MCP client connects to the workflow-engine server and no daemon is running
- **THEN** the MCP server starts the daemon process before handling the request

### Requirement: Socket-based process discovery
The engine SHALL use `~/.codecorral/daemon.sock` (Unix domain socket) for process discovery. The daemon SHALL create the socket on startup and remove it on shutdown. The daemon SHALL also write its PID to `~/.codecorral/daemon.pid`.

#### Scenario: Socket created on startup
- **WHEN** the daemon starts successfully
- **THEN** `~/.codecorral/daemon.sock` and `~/.codecorral/daemon.pid` are created

#### Scenario: Socket removed on clean shutdown
- **WHEN** the daemon receives a shutdown signal (SIGTERM, SIGINT)
- **THEN** the daemon removes `~/.codecorral/daemon.sock` and `~/.codecorral/daemon.pid` after persisting all state

#### Scenario: Stale socket detected
- **WHEN** a CLI client finds `~/.codecorral/daemon.sock` exists but connection is refused
- **THEN** the client treats the socket as stale, removes it, and starts a new daemon

### Requirement: Graceful shutdown with state persistence
The daemon SHALL persist all active workflow instance snapshots before exiting on a clean shutdown. No instance state SHALL be lost on a graceful shutdown.

#### Scenario: SIGTERM triggers graceful shutdown
- **WHEN** the daemon receives SIGTERM
- **THEN** it stops accepting new connections, persists all actor snapshots to disk, closes the socket, removes PID file, and exits with code 0

#### Scenario: All instances persisted before exit
- **WHEN** the daemon shuts down with 3 active workflow instances
- **THEN** all 3 instance files in `~/.codecorral/instances/` contain up-to-date snapshots

### Requirement: State recovery from persisted snapshots
On startup, the daemon SHALL first delete all orphaned `*.json.tmp` files in `~/.codecorral/instances/` (left by crashes during writes), then rehydrate active workflow instances from `*.json`. Instances in a final state SHALL be excluded from rehydration (no actor is created) — they remain on disk for read-only CLI access.

#### Scenario: Orphaned tmp files cleaned on startup
- **WHEN** the daemon starts and `~/.codecorral/instances/` contains `test.json.tmp`
- **THEN** the tmp file is deleted before rehydration begins

#### Scenario: Rehydrate active instances on startup
- **WHEN** the daemon starts and `~/.codecorral/instances/` contains 3 instance files, 2 in active states and 1 in a final state
- **THEN** 2 XState actors are created from the active instances' persisted snapshots, subscribed for persistence, and started. The completed instance is not rehydrated.

#### Scenario: Skip corrupted instance files
- **WHEN** an instance file contains invalid JSON
- **THEN** the daemon logs a warning, skips the file, and continues starting with remaining valid instances

#### Scenario: Handle unknown definition ID
- **WHEN** an instance file references a definition ID not in the registry
- **THEN** the daemon logs a warning, skips the instance, and continues starting

#### Scenario: Handle schema version mismatch
- **WHEN** an instance file has a `schemaVersion` that differs from the current definition version and no migration is registered
- **THEN** the daemon logs a warning, skips the instance, and continues starting

### Requirement: Explicit daemon commands
The CLI SHALL provide `codecorral daemon start`, `codecorral daemon stop`, and `codecorral daemon status` for explicit daemon management. These are optional — normal usage relies on implicit start.

#### Scenario: Explicit start
- **WHEN** the user runs `codecorral daemon start`
- **THEN** the daemon starts in the background (or foreground with `--foreground` flag)

#### Scenario: Explicit stop
- **WHEN** the user runs `codecorral daemon stop`
- **THEN** the daemon receives a graceful shutdown signal and exits after persisting state

#### Scenario: Daemon status check
- **WHEN** the user runs `codecorral daemon status`
- **THEN** the CLI reports whether the daemon is running, its PID, uptime, and number of active instances

### Requirement: Daemon logging
The daemon SHALL write logs to `~/.codecorral/daemon.log`. Logs SHALL include startup/shutdown events, instance rehydration, event processing, and errors.

#### Scenario: Startup logged
- **WHEN** the daemon starts
- **THEN** a log entry is written with the PID, number of rehydrated instances, and socket path

#### Scenario: Event processing logged
- **WHEN** an event is processed for a workflow instance
- **THEN** a log entry is written with the instance ID, event type, accepted/rejected status, and resulting state

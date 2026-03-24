## ADDED Requirements

### Requirement: codecorral status command
The CLI SHALL provide `codecorral status` to list all active workflow instances with their current state, definition ID, and last updated timestamp. `codecorral status <id>` SHALL show detailed status for a specific instance including available transitions.

#### Scenario: List all active instances
- **WHEN** the user runs `codecorral status`
- **THEN** the CLI displays a table of all active instances with columns: ID, Definition, State, Updated

#### Scenario: Show specific instance status
- **WHEN** the user runs `codecorral status test-v0.1-a1b2c3d4`
- **THEN** the CLI displays the instance's current state, definition, context fields, and available transitions with their guard status

#### Scenario: No active instances
- **WHEN** the user runs `codecorral status` and no workflow instances exist
- **THEN** the CLI displays "No active workflow instances"

### Requirement: codecorral history command
The CLI SHALL provide `codecorral history <id>` to display the event history of a workflow instance in reverse chronological order.

#### Scenario: Show event history
- **WHEN** the user runs `codecorral history test-v0.1-a1b2c3d4`
- **THEN** the CLI displays the event log with timestamps, event names, accepted/rejected status, and state transitions

#### Scenario: History for unknown instance
- **WHEN** the user runs `codecorral history nonexistent-id`
- **THEN** the CLI displays an error indicating the instance was not found

### Requirement: codecorral transition command
The CLI SHALL provide `codecorral transition <event> --instance <id> [--payload '{}']` to fire a transition on a workflow instance. The command SHALL display the transition result.

#### Scenario: Fire a transition via CLI
- **WHEN** the user runs `codecorral transition start --instance test-v0.1-a1b2c3d4`
- **THEN** the CLI sends the event to the daemon, displays the result (`accepted: true/false`, new state), and exits with code 0 on success or 1 on rejection

#### Scenario: Fire a transition with payload
- **WHEN** the user runs `codecorral transition review.revised --instance test-v0.1-a1b2c3d4 --payload '{"feedback":"needs tests"}'`
- **THEN** the CLI sends the event with the parsed payload to the daemon and displays the result

### Requirement: codecorral workspaces command
The CLI SHALL provide `codecorral workspaces` to enumerate all configured workspaces from `~/.codecorral/config.yaml` with their paths, enabled workflows, and status (whether the path exists and is accessible).

#### Scenario: List configured workspaces
- **WHEN** the user runs `codecorral workspaces` and config.yaml defines two workspaces
- **THEN** the CLI displays each workspace name, path, enabled workflows, and whether the path exists on disk

#### Scenario: No config file
- **WHEN** the user runs `codecorral workspaces` and `~/.codecorral/config.yaml` does not exist
- **THEN** the CLI displays "No configuration found. Create ~/.codecorral/config.yaml or use Nix Home Manager module."

### Requirement: Client-only commands read persisted state directly
Read-only CLI commands (`codecorral status`, `codecorral history`, `codecorral workspaces`) SHALL work without the daemon running by reading instance files and config directly from disk. The CLI SHALL silently skip instance files that return ENOENT during reads, treating them as archived.

#### Scenario: Status without daemon
- **WHEN** the user runs `codecorral status` and no daemon is running
- **THEN** the CLI reads `~/.codecorral/instances/*.json` directly and displays instance status

#### Scenario: ENOENT during read
- **WHEN** the CLI reads instance files and one is deleted between `readdir()` and `readFile()`
- **THEN** the CLI silently skips the missing file and continues with remaining instances

### Requirement: Daemon auto-start for mutating commands
Mutating CLI commands (`codecorral transition`) SHALL auto-detect and connect to the engine daemon via `~/.codecorral/daemon.sock`. If no daemon is running, the CLI SHALL auto-start one in the background before executing the command.

#### Scenario: Daemon is running
- **WHEN** the user runs a mutating CLI command and `~/.codecorral/daemon.sock` exists and is responsive
- **THEN** the CLI connects to the daemon and executes the command

#### Scenario: Daemon is not running
- **WHEN** the user runs a mutating CLI command and no daemon socket exists
- **THEN** the CLI starts the daemon in the background, waits for the socket to become available, then executes the command

#### Scenario: Stale socket file
- **WHEN** the user runs a mutating CLI command and the socket file exists but connection is refused
- **THEN** the CLI removes the stale socket, starts a new daemon, and executes the command

### Requirement: Independent installation
The CLI SHALL be independently installable via npm and Nix. The recommended npm path for daemon usage is `npm install -g codecorral`. `npx codecorral` is suitable for one-shot read-only commands but SHALL warn if it attempts to auto-start a daemon (npx cache invalidation can orphan daemons).

#### Scenario: Install via npm global
- **WHEN** the user runs `npm install -g codecorral` followed by `codecorral status`
- **THEN** the CLI executes successfully without requiring Nix or any other CodeCorral component

#### Scenario: npx with read-only command
- **WHEN** the user runs `npx codecorral status`
- **THEN** the CLI executes successfully by reading persisted state directly (no daemon needed)

#### Scenario: npx with daemon-requiring command warns
- **WHEN** the user runs `npx codecorral transition start --instance test --definition test-v0.1`
- **THEN** the CLI warns "Running via npx — daemon may not persist across npx cache updates. Consider `npm install -g codecorral` for daemon usage." and proceeds

#### Scenario: Install via Nix
- **WHEN** the user runs `nix profile install .#codecorral` followed by `codecorral status`
- **THEN** the CLI executes successfully

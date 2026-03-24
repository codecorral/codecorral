## ADDED Requirements

### Requirement: workflow.transition MCP tool
The engine SHALL expose a `workflow.transition` MCP tool that accepts `{ event: string, payload?: Record<string, unknown> }` and returns a `TransitionResult`. The tool SHALL translate the event, send it to the appropriate actor, and return the result.

#### Scenario: Agent fires a transition via MCP
- **WHEN** an agent calls `workflow.transition({ event: "submit" })` with `WFE_INSTANCE_ID` set in the environment
- **THEN** the engine translates the event, sends it to the actor identified by `WFE_INSTANCE_ID`, and returns `{ accepted: true, newState: "reviewing", phase: null, message: "..." }`

#### Scenario: Transition with payload via MCP
- **WHEN** an agent calls `workflow.transition({ event: "review.revised", payload: { feedback: "add tests" } })`
- **THEN** the engine translates the event to `{ type: "review.revised", feedback: "add tests" }`, sends it to the actor, and returns the result

#### Scenario: Transition without instance context
- **WHEN** an MCP call is made without `WFE_INSTANCE_ID` in the environment and no `--instance` parameter
- **THEN** the engine returns an error indicating no instance context is available

### Requirement: workflow.status MCP tool
The engine SHALL expose a `workflow.status` MCP tool that returns the current state of a workflow instance including `instanceId`, `definitionId`, `currentState`, `phase`, and `availableTransitions`. Available transitions SHALL use `snapshot.can()` for sync guard evaluation.

#### Scenario: Query status of active instance
- **WHEN** an agent calls `workflow.status()` with a valid `WFE_INSTANCE_ID`
- **THEN** the engine returns `{ instanceId, definitionId, currentState, phase, availableTransitions }` where each available transition includes `{ event, targetState, guards, canFire }`

#### Scenario: Query status of unknown instance
- **WHEN** `workflow.status()` is called with an instance ID that does not exist
- **THEN** the engine returns an error indicating the instance was not found

### Requirement: workflow.context MCP tool
The engine SHALL expose a `workflow.context` MCP tool that returns the XState context of the workflow instance. The context SHALL include all fields defined in the machine's context (instance-specific data like route, reviewRound, etc.).

#### Scenario: Query context of active instance
- **WHEN** an agent calls `workflow.context()` with a valid `WFE_INSTANCE_ID`
- **THEN** the engine returns the full XState context object for that instance

### Requirement: workflow.setBrowserUrl MCP tool
The engine SHALL expose a `workflow.setBrowserUrl` MCP tool that accepts `{ url: string, paneRole?: string }` and stores the URL in the workflow instance context. This is a context-setting operation only in engine-core — view-engine (Unit 5) consumes the stored URL to drive the browser pane.

#### Scenario: Agent sets browser URL
- **WHEN** an agent calls `workflow.setBrowserUrl({ url: "https://github.com/org/repo/pull/42" })`
- **THEN** the engine stores the URL in the instance context under `browserUrl`

### Requirement: Instance discovery via environment variable
The engine SHALL inject `WFE_INSTANCE_ID` as an environment variable when creating sessions (via C1 in later units). MCP tools SHALL read this variable to scope operations to the correct instance. For engine-core, the instance ID can also be passed explicitly as a tool parameter.

#### Scenario: MCP tool scoped by environment variable
- **WHEN** `WFE_INSTANCE_ID=test-v0.1-a1b2c3d4` is set in the agent's environment
- **THEN** `workflow.status()` returns the status of instance `test-v0.1-a1b2c3d4`

#### Scenario: Explicit instance ID overrides environment
- **WHEN** both `WFE_INSTANCE_ID` and an explicit `instanceId` parameter are provided
- **THEN** the explicit parameter takes precedence

### Requirement: MCP transport via stdio with per-session process
The MCP server SHALL use stdio transport per MCP SDK conventions. Each agent session SHALL get its own MCP server process — stdio is inherently single-client. The MCP process is a thin adapter that connects to the engine daemon via the Unix socket (`~/.codecorral/daemon.sock`) using JSON-RPC with Content-Length framing.

Architecture: `Agent ↔ stdio ↔ MCP process ↔ Unix socket ↔ Daemon`

The daemon is the multiplexer. Each MCP process is stateless and tied to the agent session lifecycle.

#### Scenario: MCP server starts for agent connection
- **WHEN** an agent session is configured with the `workflow-engine` MCP server
- **THEN** a new MCP server process starts via stdio, connects to the daemon socket, and exposes all workflow tools

#### Scenario: Multiple agents connect concurrently
- **WHEN** two agent sessions each have the `workflow-engine` MCP server configured
- **THEN** two separate MCP server processes are running, each connected to the daemon via independent socket connections

#### Scenario: MCP process auto-starts daemon if needed
- **WHEN** an MCP process starts and no daemon is running (no socket file)
- **THEN** the MCP process starts the daemon in the background, waits for the socket, then connects

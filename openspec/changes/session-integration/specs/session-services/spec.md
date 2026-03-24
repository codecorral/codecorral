## ADDED Requirements

### Requirement: createSession service actor
The engine SHALL provide a `createSession` service actor (`fromPromise`) that invokes `agent-deck launch` with the following parameters: work path, session title, tool (`claude`), optional parent session title, worktree branch, new branch flag, worktree location, MCP server names, and initial message. The actor SHALL parse the JSON response from stdout and return a typed `SessionRef` containing at minimum the session title and status.

#### Scenario: Successful session creation
- **WHEN** `createSession` is invoked with valid parameters including title `cc-abc12345-setup` and branch `wfe/test/setup`
- **THEN** the actor executes `agent-deck launch <workPath> -t "cc-abc12345-setup" -c claude -w "wfe/test/setup" -b --location subdirectory --mcp workflow-engine -m "<initial_message>" --json` and returns the parsed JSON response

#### Scenario: Session creation with parent
- **WHEN** `createSession` is invoked with `parentSession: "conductor-main"`
- **THEN** the launch command includes `-p "conductor-main"`

#### Scenario: Session creation failure
- **WHEN** `agent-deck launch` exits with code 1
- **THEN** the actor rejects with an error object containing `{ exitCode: 1, stderr: <captured>, command: <executed> }`

### Requirement: sendMessage service actor
The engine SHALL provide a `sendMessage` service actor (`fromPromise`) that invokes `agent-deck session send` with a session title and message string.

#### Scenario: Successful message send
- **WHEN** `sendMessage` is invoked with title `cc-abc12345-setup` and message `"Continue with implementation"`
- **THEN** the actor executes `agent-deck session send "cc-abc12345-setup" "Continue with implementation" --json` and resolves on exit code 0

#### Scenario: Message send to non-existent session
- **WHEN** `agent-deck session send` exits with code 2
- **THEN** the actor rejects with an error containing `exitCode: 2`

### Requirement: stopSession service actor
The engine SHALL provide a `stopSession` service actor (`fromPromise`) that invokes `agent-deck session stop` for a given session title.

#### Scenario: Successful session stop
- **WHEN** `stopSession` is invoked with title `cc-abc12345-setup`
- **THEN** the actor executes `agent-deck session stop "cc-abc12345-setup"` and resolves on exit code 0

#### Scenario: Stop already-stopped session
- **WHEN** `agent-deck session stop` exits with code 0 for an already-stopped session
- **THEN** the actor resolves successfully (idempotent)

### Requirement: removeSession service actor
The engine SHALL provide a `removeSession` service actor (`fromPromise`) that invokes `agent-deck remove` for a given session title.

#### Scenario: Successful session removal
- **WHEN** `removeSession` is invoked with title `cc-abc12345-setup`
- **THEN** the actor executes `agent-deck remove "cc-abc12345-setup"` and resolves on exit code 0

#### Scenario: Remove non-existent session
- **WHEN** `agent-deck remove` exits with code 2
- **THEN** the actor rejects with an error containing `exitCode: 2`

### Requirement: showSession service actor
The engine SHALL provide a `showSession` service actor (`fromPromise`) that invokes `agent-deck session show --json` and returns a typed `SessionInfo` object containing title, status, path, tool, group, attached MCPs, and optional worktree information.

#### Scenario: Successful session query
- **WHEN** `showSession` is invoked with title `cc-abc12345-setup`
- **THEN** the actor executes `agent-deck session show "cc-abc12345-setup" --json` and returns the parsed `SessionInfo`

#### Scenario: Query non-existent session
- **WHEN** `agent-deck session show` exits with code 2
- **THEN** the actor rejects with an error containing `exitCode: 2`

### Requirement: attachMcp service actor
The engine SHALL provide an `attachMcp` service actor (`fromPromise`) that invokes `agent-deck mcp attach` followed by `agent-deck session restart` for a given session title and MCP server name.

#### Scenario: Successful MCP attachment
- **WHEN** `attachMcp` is invoked with title `cc-abc12345-setup` and MCP name `workflow-engine`
- **THEN** the actor executes `agent-deck mcp attach "cc-abc12345-setup" "workflow-engine"` followed by `agent-deck session restart "cc-abc12345-setup"` and resolves when both succeed

### Requirement: setParent service actor
The engine SHALL provide a `setParent` service actor (`fromPromise`) that invokes `agent-deck session set-parent` to establish a parent-child relationship between sessions.

#### Scenario: Successful parent assignment
- **WHEN** `setParent` is invoked with child `cc-abc12345-impl` and parent `cc-abc12345-conductor`
- **THEN** the actor executes `agent-deck session set-parent "cc-abc12345-impl" "cc-abc12345-conductor"` and resolves on exit code 0

### Requirement: listSessions service actor
The engine SHALL provide a `listSessions` service actor (`fromPromise`) that invokes `agent-deck list --json` and returns an array of session info objects, optionally filtered by a title prefix.

#### Scenario: List all sessions with prefix filter
- **WHEN** `listSessions` is invoked with prefix `cc-abc12345`
- **THEN** the actor executes `agent-deck list --json`, parses the response, and returns only sessions whose title starts with `cc-abc12345`

#### Scenario: No matching sessions
- **WHEN** `listSessions` is invoked with a prefix that matches no sessions
- **THEN** the actor resolves with an empty array

### Requirement: Service actor error shape
All session service actors SHALL reject with a consistent error shape: `{ exitCode: number, stderr: string, command: string }`. This enables workflow definitions to pattern-match on exit codes in `onError` transitions.

#### Scenario: Error shape consistency
- **WHEN** any session service actor fails due to a non-zero exit code from agent-deck
- **THEN** the rejection value contains `exitCode`, `stderr`, and `command` fields

### Requirement: Service actors are registered in XState setup
All session service actors SHALL be exported as named actor creators compatible with XState v5's `setup({ actors: { ... } })` pattern, allowing workflow definitions to reference them by name and override them via `.provide()` for testing.

#### Scenario: Service actors usable in XState setup
- **WHEN** a workflow definition calls `setup({ actors: { createSession: createSessionActor, ... } })`
- **THEN** the machine can invoke `createSession` by name in any state's `invoke` field

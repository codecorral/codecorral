## ADDED Requirements

### Requirement: Actor creation from workflow definition
The engine SHALL create XState v5 actors from registered workflow definitions using `setup().createMachine()`. Each actor SHALL be bound to a specific workflow instance ID and tracked in an in-memory actor registry (`Map<string, ActorRef>`).

#### Scenario: Create actor for new workflow instance
- **WHEN** a `workflow.transition` event with type `start` is received and no actor exists for the target instance
- **THEN** the engine creates a new XState actor from the specified definition, assigns it the instance ID, adds it to the actor registry, and starts the actor

#### Scenario: Reject creation for unknown definition
- **WHEN** an actor creation is requested with a definition ID not in the definition registry
- **THEN** the engine returns an error indicating the definition is not found

### Requirement: Sequential event processing per instance
The engine SHALL process events sequentially per workflow instance using XState's built-in actor mailbox. Events sent to the same actor SHALL be queued and processed one at a time. Events to different actors SHALL be processed concurrently.

#### Scenario: Concurrent events to same instance are serialized
- **WHEN** two events are sent to the same workflow instance simultaneously
- **THEN** the second event is queued and processed only after the first event's transition completes

#### Scenario: Events to different instances process concurrently
- **WHEN** events are sent to two different workflow instances simultaneously
- **THEN** both events are processed concurrently without blocking each other

### Requirement: Snapshot persistence on every state change
The engine SHALL persist the full XState snapshot on every actor state change by subscribing to the actor via `actor.subscribe()`. Persistence SHALL use atomic write (write to temp file, rename to final path) to prevent corruption. Instance files SHALL be written to `~/.codecorral/instances/<id>.json`.

#### Scenario: State change triggers atomic persistence
- **WHEN** an actor transitions to a new state
- **THEN** the engine writes the serialized instance (id, definitionId, xstateSnapshot via `actor.getPersistedSnapshot()`, history, timestamps) to `<id>.json.tmp` and atomically renames it to `<id>.json`

#### Scenario: Partial write does not corrupt state
- **WHEN** the engine process is killed during a snapshot write
- **THEN** the instance file (`<id>.json`) contains the previous valid snapshot (the temp file is abandoned)

### Requirement: Event translation layer
The engine SHALL translate external events from the format `{ event: string, payload?: Record<string, unknown> }` to XState's internal format `{ type: string, ...flatPayload }` before sending to actors.

#### Scenario: Event with payload is translated
- **WHEN** an external event `{ event: "review.revised", payload: { feedback: "needs tests" } }` is received
- **THEN** the engine sends `{ type: "review.revised", feedback: "needs tests" }` to the XState actor

#### Scenario: Event without payload is translated
- **WHEN** an external event `{ event: "start" }` is received with no payload
- **THEN** the engine sends `{ type: "start" }` to the XState actor

### Requirement: Transition result reporting
The engine SHALL return a `TransitionResult` after processing each event, indicating whether the transition was accepted, the new state, the current phase, and an explanatory message.

#### Scenario: Accepted transition
- **WHEN** an event is sent that matches a valid transition in the current state
- **THEN** the engine returns `{ accepted: true, newState: "<target>", phase: "<phase>", message: "..." }`

#### Scenario: Rejected transition for unknown event
- **WHEN** an event is sent that has no matching transition in the current state
- **THEN** the engine returns `{ accepted: false, newState: null, phase: null, message: "No transition for event '<event>' in state '<current>'" }`

### Requirement: Definition registry
The engine SHALL maintain a definition registry (`Map<string, MachineConfig>`) mapping definition IDs to XState machine configurations. Definitions SHALL be loaded at startup from: (1) CLI-embedded defaults, (2) user-level `~/.codecorral/definitions/` overrides, (3) project-level `.codecorral/definitions/` overrides. Highest precedence wins for duplicate IDs.

#### Scenario: CLI-embedded definition is available
- **WHEN** the engine starts with no user or project overrides
- **THEN** the `test-v0.1` definition is available in the registry

#### Scenario: User-level override replaces embedded definition
- **WHEN** a definition file at `~/.codecorral/definitions/test-v0.1.js` exists
- **THEN** it takes precedence over the CLI-embedded `test-v0.1` definition

### Requirement: Event history tracking
The engine SHALL maintain an append-only event history per workflow instance. Each entry SHALL include the event type, payload, timestamp, whether the transition was accepted, and the resulting state. History SHALL be bounded at a configurable maximum (default 1000 entries) with oldest entries dropped.

#### Scenario: Successful transition is recorded
- **WHEN** an event is processed and the transition is accepted
- **THEN** a history entry with `{ event, payload, timestamp, accepted: true, fromState, toState }` is appended

#### Scenario: Rejected event is recorded
- **WHEN** an event is processed but no transition fires
- **THEN** a history entry with `{ event, payload, timestamp, accepted: false, state }` is appended

#### Scenario: History overflow drops oldest entries
- **WHEN** the history array exceeds the configured maximum
- **THEN** the oldest entries are removed to keep the array within bounds

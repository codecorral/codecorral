## ADDED Requirements

### Requirement: Composable session prompt builder
The engine SHALL provide a `buildSessionPrompt` function that composes an initial session message from structured parameters: `instanceId`, `phase`, `workflowTools` (array of MCP tool names), optional `commitGuidance`, and optional `additionalContext`.

#### Scenario: Build prompt with all parameters
- **WHEN** `buildSessionPrompt` is called with `{ instanceId: "test-v0.2-abc12345", phase: "setup", workflowTools: ["workflow.transition", "workflow.status"], commitGuidance: "Use conventional commits", additionalContext: "This is a test workflow" }`
- **THEN** the returned string contains the instance ID instruction, phase context, tool reference, commit guidance, and additional context as distinct sections

### Requirement: Instance ID injection block
The session prompt SHALL include a clearly delimited block instructing the agent to set `WFE_INSTANCE_ID` as an environment variable, containing the exact instance ID value.

#### Scenario: Instance ID block present
- **WHEN** a session prompt is built with instance ID `test-v0.2-abc12345`
- **THEN** the prompt contains text instructing the agent to run `export WFE_INSTANCE_ID="test-v0.2-abc12345"` and explains this enables automatic workflow MCP tool resolution

### Requirement: Phase context section
The session prompt SHALL include a section describing the current workflow phase and the agent's role within it.

#### Scenario: Phase context for setup
- **WHEN** a prompt is built with phase `setup`
- **THEN** the prompt contains a section describing the setup phase context

### Requirement: Workflow tool reference section
The session prompt SHALL list the available workflow MCP tools so the agent knows how to interact with the engine.

#### Scenario: Tool reference included
- **WHEN** a prompt is built with `workflowTools: ["workflow.transition", "workflow.status", "workflow.context"]`
- **THEN** the prompt contains a section listing these tools with brief descriptions of their purpose

### Requirement: Commit guidance section (optional)
When `commitGuidance` is provided, the session prompt SHALL include a section with commit message formatting instructions. When omitted, this section SHALL be absent.

#### Scenario: Commit guidance present
- **WHEN** a prompt is built with `commitGuidance: "Use conventional commits with scope matching the unit name"`
- **THEN** the prompt contains a commit guidance section with the provided text

#### Scenario: Commit guidance absent
- **WHEN** a prompt is built without `commitGuidance`
- **THEN** the prompt does not contain a commit guidance section

### Requirement: Additional context section (optional)
When `additionalContext` is provided, the session prompt SHALL append it as-is. This is the extension point for later units to inject schema-specific content.

#### Scenario: Additional context present
- **WHEN** a prompt is built with `additionalContext: "You are elaborating unit brief X"`
- **THEN** the prompt ends with a section containing the provided text

#### Scenario: Additional context absent
- **WHEN** a prompt is built without `additionalContext`
- **THEN** no additional context section appears

### Requirement: Prompt segments are pure functions
Each section of the prompt (instance ID block, phase context, tool reference, commit guidance, additional context) SHALL be produced by an individually exported pure function. This enables unit testing of each segment independently.

#### Scenario: Individual segment testability
- **WHEN** `renderInstanceIdBlock("test-v0.2-abc12345")` is called directly
- **THEN** it returns a string containing the instance ID instruction block without requiring the full `buildSessionPrompt` parameters

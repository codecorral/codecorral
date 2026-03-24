## ADDED Requirements

### Requirement: Phase prompts declared in workflow definition context
Workflow definitions SHALL declare phase-specific prompts in the machine context under a `prompts` key. Each key in `prompts` maps a phase name to the prompt string for that phase. The prompt is the definition author's instructions to the agent — what to do, what tools to use, what artifacts to produce.

#### Scenario: Definition declares phase prompts
- **WHEN** a workflow definition is created with `context.prompts = { elaboration: "You are elaborating...", implementation: "You are implementing..." }`
- **THEN** those prompts are available in context for use as `createSession` initial messages

#### Scenario: Phase prompt used at session creation
- **WHEN** a state invokes `createSession` and derives `initialMessage` from `context.prompts.elaboration`
- **THEN** the session receives the elaboration-specific prompt as its initial message

### Requirement: Engine preamble auto-prepended to phase prompts
The engine SHALL prepend a preamble to the phase prompt before passing it to `createSession`. The preamble contains engine-level concerns only: `WFE_INSTANCE_ID` injection instruction and available workflow MCP tools. The phase prompt is appended as-is.

#### Scenario: Preamble prepended to phase prompt
- **WHEN** `assembleSessionPrompt` is called with instanceId `test-v0.2-abc12345`, phasePrompt `"You are in a test workflow."`, and tools `["workflow.transition", "workflow.status"]`
- **THEN** the returned string starts with the instance ID instruction block and tool listing, followed by the phase prompt

#### Scenario: Empty phase prompt gets only preamble
- **WHEN** `assembleSessionPrompt` is called with an empty phasePrompt
- **THEN** the returned string contains only the preamble (instance ID + tools)

### Requirement: assembleSessionPrompt function
The engine SHALL provide an `assembleSessionPrompt(instanceId, phasePrompt, workflowTools)` function that concatenates the engine preamble with the definition-provided phase prompt. This is a thin formatter, not a prompt authoring system.

#### Scenario: Function signature and output
- **WHEN** `assembleSessionPrompt("test-v0.2-abc12345", "Call workflow.transition('impl.complete') when done.", ["workflow.transition", "workflow.status", "workflow.context"])` is called
- **THEN** the result contains three sections: (1) instance ID export instruction, (2) workflow tool listing, (3) the phase prompt text

### Requirement: Preamble instance ID block
The preamble SHALL include a clearly delimited block instructing the agent to set `WFE_INSTANCE_ID` as an environment variable, containing the exact instance ID value.

#### Scenario: Instance ID block format
- **WHEN** the preamble is generated for instance `test-v0.2-abc12345`
- **THEN** it contains text instructing the agent to run `export WFE_INSTANCE_ID="test-v0.2-abc12345"` and explains this enables automatic workflow MCP tool resolution

### Requirement: Preamble workflow tool listing
The preamble SHALL list the available workflow MCP tools so the agent knows how to interact with the engine.

#### Scenario: Tool listing included
- **WHEN** the preamble is generated with tools `["workflow.transition", "workflow.status", "workflow.context"]`
- **THEN** it contains a section listing these tools with brief descriptions

### Requirement: Prompts are overridable via definition precedence
Since prompts live in the machine context, they follow definition precedence (D19): CLI-embedded defaults can be overridden by user-level or project-level definition files. This allows users to customize phase prompts without forking the workflow definition.

#### Scenario: Override via .provide()
- **WHEN** a workflow actor is created with `.provide({ ... })` that modifies the initial context
- **THEN** the prompts in context reflect the override, not the defaults

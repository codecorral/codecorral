## ADDED Requirements

### Requirement: Five elaboration agent personas
The system SHALL provide five Claude Code agent definition files in `.claude/agents/`, one per mob elaboration role: `mob-analyst.md`, `mob-architect.md`, `mob-domain-modeler.md`, `mob-qa-strategist.md`, and `mob-critic.md`.

#### Scenario: Agent file structure
- **WHEN** a mob elaboration agent file is read
- **THEN** it SHALL contain valid Claude Code agent frontmatter with `name`, `model`, and `description` fields, followed by a system prompt body

#### Scenario: Agent file discovery
- **WHEN** Claude Code lists available agents in `.claude/agents/`
- **THEN** all five `mob-*.md` files SHALL appear and be selectable as agent types

### Requirement: Each persona defines a distinct analytical focus
Each agent persona SHALL have a system prompt that establishes a unique perspective: Product Analyst focuses on user outcomes and acceptance criteria, System Architect focuses on components and interfaces, Domain Modeler focuses on business rules and ubiquitous language, QA Strategist focuses on test strategy and edge cases, Devil's Advocate focuses on risks and contradictions.

#### Scenario: Non-overlapping analysis
- **WHEN** all five agents analyze the same intent brief
- **THEN** each agent SHALL produce a distinct artifact type (requirements-draft, architecture-draft, domain-model, test-strategy-draft, risk-analysis) with minimal content overlap

#### Scenario: Product Analyst output
- **WHEN** the Product Analyst agent processes an intent brief
- **THEN** it SHALL produce a requirements document containing functional requirements (FR-N format), non-functional requirements, user-facing acceptance criteria, and open questions for the human

#### Scenario: System Architect output
- **WHEN** the System Architect agent processes an intent brief
- **THEN** it SHALL produce an architecture document containing a system context diagram (mermaid), affected components inventory, 2-3 architectural options with tradeoffs, and a recommended approach with rationale

#### Scenario: Devil's Advocate output
- **WHEN** the Devil's Advocate agent processes an intent brief and other agents' artifacts
- **THEN** it SHALL produce a risk analysis containing at least 5 challenges per artifact reviewed, each with target, issue, evidence, severity, and a suggested question for the human

### Requirement: Personas include cross-review instructions
Each agent persona's system prompt SHALL include explicit instructions to message other agents during cross-review phases — not just produce files, but actively use SendMessage to challenge, validate, or request clarification from specific teammates.

#### Scenario: Critic challenges Analyst
- **WHEN** the Devil's Advocate reads the Analyst's requirements-draft.md during Phase 2
- **THEN** it SHALL send a direct message to the Analyst identifying specific requirements that are ambiguous, untestable, or conflicting

#### Scenario: Architect validates with Domain Modeler
- **WHEN** the System Architect reads the Domain Modeler's domain-model.md during Phase 2
- **THEN** it SHALL send a direct message confirming or disputing whether technical component boundaries align with domain bounded contexts

### Requirement: Personas define output format templates
Each agent persona SHALL include a structured output format section in its system prompt that specifies the Markdown structure, heading hierarchy, and required sections for its artifact type.

#### Scenario: Consistent artifact structure
- **WHEN** the same persona is used across multiple elaboration sessions
- **THEN** the artifact it produces SHALL follow the same heading structure and section layout each time

### Requirement: Three-agent subset for lean mob
The system SHALL support a 3-agent "lean mob" configuration using only the Analyst, Architect, and Critic personas. The Analyst absorbs domain modeling concerns and the Critic absorbs QA strategy concerns in this configuration.

#### Scenario: Lean mob role coverage
- **WHEN** a 3-agent lean mob is spawned
- **THEN** the Analyst persona SHALL include instructions to cover domain language consistency in its requirements, and the Critic persona SHALL include instructions to cover test strategy and edge cases in its risk analysis

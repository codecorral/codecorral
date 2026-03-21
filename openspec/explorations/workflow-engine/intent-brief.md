# CodeCorral Workflow Engine — Intent Brief

## Problem Statement

CodeCorral's AI-DLC lifecycle currently relies on ad-hoc orchestration — the conductor infers workflow state from scattered artifacts, git history, and bead queries rather than tracking it explicitly. This makes the system fragile: state is distributed across tools (agent-deck, cmux, OpenSpec, beads-rust) with no single authority on where a unit of work stands. Adding new workflow phases, customizing behavior per project, or running multiple workflows concurrently requires manual coordination that doesn't scale.

The developer surface (tmux panes, workspaces, notifications) is manually configured per session rather than driven by workflow phase, meaning the visual context doesn't automatically reflect what's happening. Agents lack a structured interface to report progress or request transitions — they rely on the conductor interpreting natural language signals.

There is no standalone CLI for humans to inspect, control, or configure workflows outside of an agent session. The system is not installable independently of the full CodeCorral development environment.

## Desired Outcome

A workflow engine that serves as the single source of truth for where every unit of work stands in the AI-DLC lifecycle. Specifically:

- **Explicit state machines** (XState) replace inferred state. Each workflow instance is a persisted, queryable, auditable process with typed events, deterministic guards, and declared transitions.
- **A standalone CLI** (`codecorral`) that can be independently installed (via npm, Nix, or Homebrew) and used without the full CodeCorral environment. The CLI connects to a daemon for runtime operations and works standalone for configuration and inspection.
- **A Claude Code agent plugin** that provides MCP tools, hooks, and skills for agents to participate in workflows — reporting events, querying state, and receiving phase-appropriate session prompts.
- **Declarative workspace configuration** via a Nix flake, allowing users to define project workspaces, board adapters, workflow definition overrides, and surface layouts as code. The CLI can enumerate configured workspaces.
- **Phase-driven developer surface** where workspace layouts, panes, and notifications are automatically reconfigured as workflows transition between phases.
- **Conductor as LLM bridge** — the conductor retains its role for judgment calls, board polling, and notification bridging, but no longer tracks workflow state. The engine is deterministic; the conductor is the LLM-dependent complement.
- **Three built-in OpenSpec schemas with paired workflow definitions:**
  - **Intent** (`dev.codecorral.intent`) — Inception workflow. Takes a raw idea through intent-brief, requirements, system-context, unit decomposition, and bolt-plan. Already exists as a schema; needs a paired workflow definition. Publishes unit briefs to the task board.
  - **Unit** (`dev.codecorral.unit`) — The core elaboration-to-implementation workflow. Consumes a unit brief from the task board. Drives it through proposal, design, spec, review, implementation, code review, verification, and completion. This is the workflow previously referred to as "proposal" in the domain model — renamed to "unit" because it operates on units of work, not proposals.
  - **T2D** (`dev.codecorral.t2d`) — Text-to-diagram workflow. Converts the recipe-based pipeline from [t2d-kit](https://github.com/afterthought/t2d-kit) into an OpenSpec schema and CodeCorral workflow. Takes a natural-language description or YAML recipe as input, transforms it into diagram specifications, and generates diagrams (D2, Mermaid, PlantUML) plus documentation. Serves as both a useful built-in capability and a reference implementation of a non-software-development workflow running on CodeCorral.
- **Schema-to-workflow authoring skill** — A skill in the Claude Code plugin that lets CodeCorral users create new workflow definitions from their own custom OpenSpec schemas. Given a schema, the skill generates a matching workflow definition (XState machine config), view configs, session prompts, and guard definitions. This makes the system extensible beyond the three built-in workflows without requiring users to hand-author state machines.
- **Incremental unit delivery** — each unit of the engine itself ships a progressively richer workflow definition version, with stub interfaces at the boundary of subsequent units. Agents implementing a unit only see the scoped definition for that unit.

## Scope

### In scope

- Workflow engine daemon with XState-based state machines, event queue, guard evaluation, action dispatch, and state persistence
- CLI (`codecorral`) for workflow inspection, control, workspace enumeration, and configuration — independently installable
- Claude Code agent plugin (MCP tools, hooks, skills) for agent participation in workflows, including the schema-to-workflow authoring skill
- Nix flake for declarative workspace and workflow configuration
- Three built-in OpenSpec schemas with paired workflow definitions: intent, unit, and t2d
- T2D schema and workflow definition ported from [t2d-kit](https://github.com/afterthought/t2d-kit) — recipe model, transform agent, multi-framework diagram generation (D2, Mermaid, PlantUML), and documentation output
- Contracts with session management (agent-deck), developer surface (cmux), and change management (OpenSpec) as defined in the contracts document
- Board adapter interface with at least one concrete adapter (GitHub Issues or local filesystem)
- Conductor integration — `conductor.instruct` action and notification bridging
- View config system driving cmux workspace layouts per phase
- Workflow definition distribution via Nix package and npm
- Session prompt injection with phase-appropriate context and commit guidance
- Guard system for git state verification (worktree clean, artifact exists, tests passed)
- Event sourcing from three origins: agent (MCP), human (CLI/conductor), deterministic (Claude Code hooks)

### Out of scope

- Runtime composition of state machines (D21 — deferred to v2)
- Conductor pools for high-parallelism scaling (D2 — monitor, design later)
- Board adapters beyond the initial one or two (Linear, Jira adapters are future work)
- Self-improving retrospective system (D24 — the RETROSPECTIVE state exists but tuning heuristics are future work)
- Custom event plugin system beyond composition and forking of definitions
- Mobile or web UI — developer surface is terminal-native (cmux/tmux)
- Agent-deck or cmux internal changes — the engine consumes their existing CLIs and APIs

## Stakeholders

- **Solo developers using AI-DLC** — Primary users. They pull briefs, review artifacts, approve transitions, and monitor agent work through the CLI and developer surface.
- **Agent sessions** — Consumers of the MCP interface. They report events, query workflow state, and receive session prompts. Their experience is shaped by the prompt injection and tool availability.
- **The conductor** — A specialized agent session that bridges LLM capabilities to the deterministic engine. It polls boards, makes routing decisions, and handles notification.
- **Downstream tool maintainers** (agent-deck, cmux, OpenSpec) — Their CLIs and APIs are consumed via contracts. Changes to those contracts affect the engine.
- **Future plugin/marketplace consumers** — Users who install CodeCorral as a Claude Code plugin without the full Nix environment.
- **Custom workflow authors** — Users who write their own OpenSpec schemas and use the authoring skill to generate matching workflow definitions. They need the skill output to be correct and complete enough to run without hand-editing XState configs.

## Constraints

- **Agent-deck CLI is the session interface.** The engine does not manage tmux sessions directly for agent work — it issues commands through agent-deck's CLI (v0.8.x). Managed sessions for ancillary panes (git diff, sidecar) may use agent-deck or raw tmux (D14 — to be resolved).
- **cmux socket API is the surface interface.** The engine drives developer surface layout through cmux's existing socket protocol, not by managing tmux directly.
- **OpenSpec schemas are upstream.** The engine conforms to OpenSpec's artifact structure. Schema changes flow downstream to workflow definitions, not the reverse.
- **XState v5 is the state machine runtime.** Workflow definitions are XState machine configs. This constrains the definition format and composition model.
- **Deterministic session naming (D1, D6).** Session names encode workflow ID, phase, and role — no stored session ID tracking. Sessions are discovered by name pattern.
- **Agent-deck owns worktrees (D2).** The engine knows session names; agent-deck resolves to worktree paths. Instance files live in `~/.codecorral/instances/`, not in any repo.
- **Versioned, immutable workflow definitions.** Each unit of delivery ships a definition version (e.g., `unit-v0.N`, `intent-v0.N`, `t2d-v0.N`). The definition is the hard scope boundary — agents cannot build states that don't exist in their definition version.
- **T2D workflow inherits t2d-kit's recipe model.** The Pydantic recipe model, diagram framework support (D2, Mermaid, PlantUML), and transform→generate pipeline from t2d-kit are the starting point. The port converts these into OpenSpec artifacts and a CodeCorral workflow, not a rewrite from scratch.
- **Schema-to-workflow skill produces standard artifacts.** The authoring skill generates XState machine configs, view configs, session prompts, and guard stubs. Users may then customize, but the skill output must be a valid, runnable workflow definition — not a skeleton that requires manual wiring.
- **CLI must be independently installable.** Users who don't use Nix or the full CodeCorral environment can install via npm (`npx codecorral`) or Homebrew. The Nix flake is the declarative path but not the only path.
- **Review decisions D1–D25 are binding constraints** unless explicitly revisited. The intent brief assumes these decisions hold as documented in `review-decisions.md`.

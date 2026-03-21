# AI-DLC ↔ CodeCorral Workflow Engine Mapping

## Phase-to-Workflow Mapping

AI-DLC has three phases. CodeCorral implements them as **two separate workflow definitions** that compose through a task board (anti-corruption layer):

| AI-DLC Phase | CodeCorral Workflow Definition | Key Mechanism |
|-------------|-------------------------------|---------------|
| Inception | **Intent workflow** (`dev.codecorral.intent`) | Takes raw idea → intent-brief → requirements → system-context → unit decomposition → bolt-plan. Publishes unit briefs to task board. |
| Construction | **Unit workflow** (`dev.codecorral.unit`, formerly "proposal") | Consumes unit brief from board. Drives through elaboration → implementation → code review → verification → completion. |
| Operations | Outside current scope | — |

The two workflows are **loosely coupled through the task board** — no runtime coupling, different machines, different schemas, different schedules.

## Artifact Mapping

| AI-DLC Artifact | CodeCorral Equivalent | Notes |
|----------------|----------------------|-------|
| Intent | **Intent brief** — entry point to the intent workflow | Raw idea captured as an OpenSpec artifact |
| Unit | **Unit brief** — entry point to the unit workflow | Published to task board by intent workflow, pulled by conductor |
| Bolt | **Workflow instance iteration** | A unit executes through phases of a single workflow instance; bolt-level granularity is within the implementation phase |
| User Story | OpenSpec artifact within intent workflow | Generated during inception, persisted as change artifacts |
| Domain Design | OpenSpec artifact within unit workflow elaboration phase | Agent generates during elaboration, human reviews at gate |
| Logical Design | OpenSpec artifact within unit workflow elaboration phase | Extends domain design with NFRs and architectural patterns |
| Deployment Unit | Implementation output | Code, IaC, tests — produced during construction phases |
| Level 1 Plan | Intent workflow output → unit decomposition + bolt-plan | AI proposes, human validates at review gate |
| PRFAQ | OpenSpec artifact (optional) | Generated during inception |

## Ritual Mapping

| AI-DLC Ritual | CodeCorral Mechanism |
|---------------|---------------------|
| Mob Elaboration | **OpenMob ceremonies** via the intent workflow. AI proposes breakdown; humans review at workflow review gates. |
| Mob Construction | **Multi-session workflows** — each unit workflow instance can run multiple agent-deck sessions (elaboration, implementation, review) with worktree isolation. Teams exchange integration specs via artifacts. |
| Mob Testing | Agent-based testing within unit workflow. AI executes tests, analyzes results, proposes fixes. Workflow guards enforce clean worktree and passing tests before transitions. |
| Human validation gates | **Workflow review states** — explicit states in the XState machine where the workflow pauses for human approval (`review.approved` / `review.revised` events). |

## Role Mapping

| AI-DLC Role | CodeCorral Implementation |
|-------------|--------------------------|
| AI (Domain-Specific Agent) | **Agent-deck sessions** running Claude Code with workflow-injected session prompts. Multiple sessions per workflow instance (elaboration agent, implementation agent, review agent). |
| Product Owner / Developer | **Human** interacting via CLI (`codecorral approve`, `codecorral revise`) or developer surface (cmux). The conductor bridges notifications (Telegram/Discord). |
| AI orchestrator | **Workflow engine daemon** (deterministic, XState-based) + **Conductor** (LLM bridge, one per profile). Engine drives state; conductor provides judgment. |

## Principle Alignment

| AI-DLC Principle | CodeCorral Design Decision |
|-----------------|---------------------------|
| P2: Reverse conversation direction | Conductor initiates — polls board, pulls briefs, auto-responds to agents. Engine drives workflow; humans approve at gates. |
| P9: Minimize stages, maximize flow | Human validation at review gates acts as "loss function" — catching errors early before they snowball. Guards enforce preconditions (clean worktree, artifact exists, tests pass). |
| P10: No hard-wired workflows | Intent routing via `route` field on unit briefs (incremental vs fast-forward). Workflow definitions are versioned and overridable at project and user level (D19). Multiple schemas can share a workflow definition (D22). |
| P3: Integrate design techniques | DDD principles baked into the elaboration phase — domain design → logical design is a first-class workflow transition, not optional. |
| P6: Retain human symbiosis | Explicit review states in XState machines. Every major transition has a human gate. Context memory via persisted, linked OpenSpec artifacts. |

## Architecture — Bounded Contexts

CodeCorral's workflow engine sits at the center of four bounded contexts:

| Context | Tool | Relationship to Engine |
|---------|------|----------------------|
| **Workflow Engine** | XState daemon | Owns workflow definitions, state machines, transitions, guards, actions, view mappings |
| **Session Management** | agent-deck | Customer-Supplier — engine creates/manages sessions via CLI |
| **Developer Surface** | cmux | Customer-Supplier — engine drives workspace layouts per phase |
| **Change Management** | OpenSpec | Conformist — engine conforms to schema artifact structure |
| **Task Board** | GitHub Issues / Linear / local | Anti-corruption layer — board adapter normalizes external systems |

## Key Shift from Earlier "Dark Factory" Exploration

| Old Concept | New Concept |
|---|---|
| Beads as spine | **XState actors** as spine (explicit state machines with typed events) |
| Conductor drives pipeline | **Engine drives pipeline** deterministically; conductor is LLM bridge + board poller |
| Ralph TUI for execution | **Agent-deck sessions** for execution, multiple per workflow |
| Three loops (ideation → spec → impl) | **Two workflow definitions** (intent → unit) composing through task board |
| File scanning / bead queries for state | **Persisted XState snapshots** — single source of truth per workflow instance |
| Git commits as pipeline steps | **Git commits as agent responsibility** with guard-enforced checkpoints |

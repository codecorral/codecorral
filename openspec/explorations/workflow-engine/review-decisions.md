# CodeCorral Workflow Engine — Review Decisions Log

Captured from tuicr review sessions against `domain-model.md`. Each item needs a design decision before moving to a formal spec.

## Resolved

*(none yet — move items here as they're decided)*

## Needs Design

### D1: Session naming convention (deterministic vs stored IDs)
**Source:** Review #1
**Question:** Rather than storing agent-deck session IDs in the workflow instance, use deterministic session names that encode our identifiers (workflow ID, phase, role).
**Proposed:** `codecorral-{workflowId}-{phase}-{role}` for phase-specific, `codecorral-{workflowId}-{role}` for persistent.
**Implication:** No need to track session IDs in the instance — they're derived. Agent-deck sessions can be referenced by name.

### D2: Worktree ownership — engine vs session management
**Source:** Review #2
**Question:** Does the workflow engine track worktree paths, or is that purely agent-deck's concern? Where does the workflow instance file live — with the conductor, outside the repo?
**Leaning:** Agent-deck owns worktrees. Engine knows the session name, agent-deck resolves to worktree. Instance files live in `~/.codecorral/instances/`, not in any repo.

### D3: Field naming consistency
**Source:** Reviews #3, #4
**Changes needed:**
- `changeName` → `openspecChangeName` (or just `changeName` with clear docs)
- `cmuxWorkspaceId` → `windowId` (since it maps to a cmux window per profile)
- Keep `cmuxWorkspaceId` for the workspace within the window

### D4: Transition side-effect pseudocode
**Source:** Review #5
**Question:** The `managedSessions` field in the instance doesn't make sense without seeing the pseudocode for what happens during a transition.
**Needed:** Write pseudocode for a representative transition (e.g., ELABORATING → HUMAN_REVIEW) showing exactly what actions fire and how views update.

### D5: Branding — "wfe" vs "codecorral"
**Source:** Review #6
**Question:** Is the CLI `wfe` (workflow engine) or `codecorral`? Is "workflow engine" an internal component name or the user-facing product?
**Options:**
- `codecorral` as the CLI, "workflow engine" as internal architecture term
- `wfe` as a subcommand: `codecorral wfe status`
- Keep them separate: `codecorral` for config/install, `wfe` for runtime

### D6: Managed session naming — use deterministic names only
**Source:** Review #7
**Question:** If session names are deterministic (D1), managed sessions don't need separate tracking. Phase-specific = `codecorral-{id}-{state}-{role}`, workflow-wide = `codecorral-{id}-{role}`.
**Resolution:** Drops the `managedSessions` array from the instance. Sessions are discovered by name pattern.

### D7: Dynamic browser URLs from LLM
**Source:** Review #8
**Question:** How does an agent set a browser URL without writing Python? The MCP tool `workflow.setBrowserUrl(url)` handles this — agent just calls the tool with the URL string. No templating needed for LLM-generated URLs.
**Note:** Static URLs in view configs use templates. Dynamic URLs from agents use the MCP tool. Two paths, both clean.

### D8: Agent-based reviews and approvals
**Source:** Review #9
**Question:** The human review events should also allow for agent-based review (e.g., CodeRabbit, custom review agents). The `review.approved` / `review.revised` events don't need to distinguish human vs agent — they're the same event from different sources.
**Implication:** Review agents fire the same `workflow.transition("review.approved")` as humans. Guards don't care who approved.

### D9: PR creation via hooks
**Source:** Review #10
**Question:** Can PR creation be detected via git hooks?
**Answer:** Yes — a post-push hook or GitHub webhook can fire `pr.created`. Or the agent fires it via MCP after running `gh pr create`.

### D10: Code reviews are LLM-based
**Source:** Review #11
**Confirmed:** Code review is an agent session (CodeRabbit, custom review agent, or a Claude Code subagent with the pr-review-toolkit plugin). Not a deterministic tool.

### D11: Child session lifecycle management
**Source:** Review #12
**Question:** Sessions can spawn child agent-deck sessions. Need to formalize:
- Parent is responsible for monitoring and closing children
- Before closing a session, ensure children are closed first
- Sessions may be "stopped" (resources freed, tmux session killed) but not "deleted" (agent-deck record retained) until workflow completes
**Lifecycle:** running → stopped → deleted. Only delete after workflow completion.

### D12: Agent-deck profile layout design
**Source:** Review #13
**Needed:** Design the agent-deck profile structure that corresponds to a CodeCorral workspace:
- How groups map to workflows or repos
- How conductor parent-child relationships work
- Where in the group hierarchy workflow sessions live

### D13: `conductor.instruct` use cases
**Source:** Review #14
**Question:** What does `conductor.instruct` actually do? Use cases:
- Engine needs LLM judgment: "evaluate this unit brief and decide the route"
- Engine needs notification sent: "tell the user via Telegram that review is needed"
- Engine needs board interaction: "pull the next available brief"
- The conductor is a Claude Code session — instruction is literally sending text to its conversation.

### D14: Managed sessions via agent-deck vs raw tmux
**Source:** Review #15
**Question:** Should ancillary panes (git diff, sidecar, file explorer) be agent-deck sessions or raw tmux?
**Leaning:** Use agent-deck if it provides value (status tracking, lifecycle management). Use raw tmux if it's simpler for non-agent processes. Probably agent-deck for everything since we want consistent naming and cleanup.

### D15: Multi-repo board configuration
**Source:** Review #16
**Question:** A profile/workspace could span multiple repositories, each with its own issue board. Board adapter config needs to support per-repo board mappings, not just per-profile.
**Needed:** Design board adapter config that maps repos to board sources.

### D16: Pull semantics vary by schema
**Source:** Review #17
**Clarification:** The intent workflow pulls "intent briefs" (raw ideas). The proposal workflow pulls "unit briefs" (decomposed units). The board adapter should be generic — it pulls "work items" and the workflow definition interprets them.

### D17: Distribution as a Claude Code plugin/marketplace
**Source:** Reviews #18, #19
**Question:** Should CodeCorral be distributed as:
- A skill (or set of skills) for Claude Code
- A marketplace plugin with skills, agents, hooks, and MCP
- A CLI + MCP server (Nix + npm)
- All of the above
**Leaning:** Plugin marketplace for Claude Code integration (skills, agents, hooks), plus standalone CLI + MCP server for non-Claude-Code usage. Nix flake for declarative installation.

### D18: Developer surface is driven by actions, not phase mapping
**Source:** Review #20
**Question:** The current model maps phases to view configs 1:1. But the actual developer surface should be driven by the side-effect actions of transitions — which can be more dynamic than a static phase→view mapping.
**Implication:** View configs are defaults per phase, but actions can modify the view at any transition. The view is the result of accumulated actions, not just the current phase.

### D19: Workflow definition precedence and overrides
**Source:** Review #21
**Question:** Where do workflow definitions live, in precedence order?
1. CLI-embedded defaults (shipped with CodeCorral)
2. Project-level overrides (`.codecorral/definitions/` in repo)
3. User-level overrides (`~/.codecorral/definitions/`)
**Highest priority wins, keyed by unique name.**

### D20: Project-level vs user-level config
**Source:** Review #22
**Question:** Config should support both project-level (repo) and user-level (profile). Similar to how `.claude/settings.json` and `~/.claude/settings.json` merge.
**Structure:**
- `~/.codecorral/config.yaml` — user defaults
- `.codecorral/config.yaml` — project overrides
- Merge with project taking precedence for project-specific settings

### D21: Runtime composition of state machines
**Source:** Review #23
**Question:** Can users compose/extend state machines at runtime? XState machines are JavaScript, so overrides would need to be JS too. This may be too complex for v1.
**Leaning:** v1 supports definition selection (pick which machine) and config overrides (guard thresholds, timeouts). Runtime composition (adding states/transitions) deferred to v2.

### D22: Schema-to-definition relationship (many-to-one)
**Source:** Review #24
**Resolved:** Multiple schemas can share the same workflow definition. Schemas don't know about workflow definitions — they just use MCP tools. An environment context identifier tells the engine which definition to use. Different schema versions can flow through the same engine.

### D23: Agent-controlled panes — their own, not ours
**Source:** Review #27
**Resolved:** Agents can open their own cmux panes directly (using cmux CLI/socket API). They should NOT be able to modify engine-managed panes. Clean separation:
- Engine manages: phase-default panes, managed sessions
- Agents manage: any additional panes they open directly via cmux

### D24: Post-workflow retrospective
**Source:** Review #28
**Question:** After workflow completion and git operations, before deleting sessions:
1. Collect a summary of how the process went (time, review rounds, rework count)
2. Store in memory (MCP memory tool or `~/.codecorral/retrospectives/`)
3. Feed into self-improving system (tune guards, review thresholds, routing heuristics)
**Implication:** Need a COMPLETING → RETROSPECTIVE → CLEANUP → COMPLETE state sequence, not just COMPLETING → COMPLETE.

### D25: Client-only vs daemon mode
**Source:** Review #29
**Question:** How does the CLI distinguish between:
- Connecting to a running daemon
- Running in standalone mode (no daemon, reads/writes state directly)
- Starting a daemon because none is running
**Needed:** Define the daemon lifecycle: auto-start on first `codecorral` command? Explicit `codecorral daemon start`? Socket file presence detection?

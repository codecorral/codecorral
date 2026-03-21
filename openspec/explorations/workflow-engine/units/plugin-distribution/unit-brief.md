## Unit: plugin-distribution

**Description:** Packages CodeCorral as a Claude Code agent plugin, distributes it via npm and Nix, and ships the schema-to-workflow authoring skill. The plugin bundles MCP tools, hooks, and skills. The Nix flake enables declarative workspace configuration with conductor policy overrides. The authoring skill generates complete workflow definitions from custom OpenSpec schemas.

**Deliverable:** Claude Code agent plugin (`plugin.json`, MCP tools, hooks, skills). npm package (`npx codecorral`). Nix flake with Home Manager module for declarative workspace configuration (conductor policy per workspace, workflow definition overrides, board config, view config overrides). Schema-to-workflow authoring skill that generates XState machine configs, view configs, session prompts, and guard stubs from any OpenSpec schema.

**Dependencies:** t2d-workflow

## Relevant Requirements

- Claude Code agent plugin that provides MCP tools, hooks, and skills for agents to participate in workflows
- Schema-to-workflow authoring skill — generates matching workflow definitions from custom OpenSpec schemas
- CLI independently installable via npm or Homebrew
- Nix flake for declarative workspace and workflow configuration
- CLI can enumerate configured workspaces
- Schema-to-workflow skill produces standard artifacts — output must be valid, runnable without hand-editing

## System Context

**Claude Code plugin structure:**
- `plugin.json` manifest declaring MCP tools, hooks, skills, and agents
- MCP tools: `workflow.transition`, `workflow.status`, `workflow.context`, `workflow.setBrowserUrl` (already built in Unit 1, packaged here)
- Hooks: `PostToolUse` hooks for detecting test completion (`tests.passed`/`tests.failed`), PR creation (`pr.created`), and other deterministic events. `SessionStart` hook for `WFE_INSTANCE_ID` injection.
- Skills: `/codecorral pull`, `/codecorral approve`, `/codecorral status`, plus the schema-to-workflow authoring skill
- Agents: Optional conductor agent definition for the plugin marketplace

**Nix flake for declarative configuration:**
```nix
codecorral.workspaces.my-project = {
  workflows = [ "intent" "unit" ];           # which workflow definitions to enable
  conductor.extraPolicy = "...";             # extend conductor POLICY.md
  conductor.boardConfig = { ... };           # board polling configuration
  definitions.overrides = { ... };           # .provide() overrides for guard thresholds
  viewConfigs.overrides = { ... };           # per-phase view config customization
};
```

The flake module generates:
- Conductor CLAUDE.md and POLICY.md (merging defaults with workspace overrides)
- Workflow definition overrides (applied via `.provide()` at actor creation)
- Config files at `~/.codecorral/config.yaml`

**Schema-to-workflow authoring skill:**

Given an OpenSpec schema, the skill generates:
1. XState machine config (`setup().createMachine()` — states for each artifact + review gates + completion)
2. View configs (one per phase, using sensible defaults for pane layout)
3. Session prompts (referencing the schema's artifact instructions)
4. Guard stubs (precondition services for `checkArtifactExists` per artifact)
5. Workflow definition metadata (name, version, description)

The skill uses the three built-in workflows (intent, unit, t2d) as reference implementations — particularly t2d, which is the simplest non-trivial example. The output is a complete, runnable definition that users can customize but don't have to.

**Distribution paths:**
| Path | Audience | Mechanism |
|---|---|---|
| npm | Non-Nix users | `npx codecorral` or `npm install -g codecorral` |
| Nix flake | Declarative users | `nix profile install` or Home Manager module |
| Claude Code marketplace | Plugin users | Plugin install via Claude Code |
| Homebrew | macOS users | `brew install codecorral` (future) |

## Scope Boundaries

**In scope:**
- Claude Code plugin manifest (`plugin.json`) and packaging
- Plugin hooks: `PostToolUse` for test/PR detection, `SessionStart` for environment injection
- Plugin skills: `/codecorral pull`, `/codecorral approve`, `/codecorral status`
- Schema-to-workflow authoring skill (generates complete workflow definitions from OpenSpec schemas)
- npm package configuration and publishing setup
- Nix flake with Home Manager module for workspace configuration
- Conductor policy generation from Nix flake config
- `.provide()` override generation from Nix flake config (guard thresholds, timeouts)
- `codecorral workspaces` command enhanced with Nix-configured workspace enumeration
- Documentation for non-Nix users (`.codecorral/config.yaml` manual configuration)

**Out of scope:**
- Homebrew formula (future — track as follow-up)
- Runtime structural composition of state machines (D21 — v2)
- Plugin marketplace infrastructure — CodeCorral is a plugin in the marketplace, not the marketplace itself
- Modifying the engine core, session integration, conductor, or built-in workflow definitions — this unit packages and extends, not rewrites

## Context

The engine-core change shipped workspace configuration, a config loader, a CLI command, and a Home Manager module. The HM module has bugs (JSON output, broken Nix build) and its delegation model is incomplete. Additionally, "workspace" collides with cmux's terminology for vertical tabs.

Review of the upstream modules revealed two key constraints: (1) **nix-agent-deck profiles only accept `claude.configDir`** — conductor, MCPs, shell, docker, and other settings are global (`programs.agent-deck.*`), not per-profile; (2) **agentplot-kit's claude-code module** supports rich per-profile content (settings, agents, rules, skills, MCPs), but the upstream nix-community/home-manager claude-code module does NOT have profiles — agentplot-kit is required.

Global agent-deck configuration (conductor, MCPs, shell, docker) is the user's responsibility via `programs.agent-deck` directly. Session/group layout and conductor definitions will be handled by the `configure-agent-deck-session` intent (via shuffle deck YAML files) in a future change. This change focuses on per-project claude-code delegation and the agent-deck `config_dir` convention.

## Goals / Non-Goals

**Goals:**
- Rename "workspace" → "project" consistently (snake_case per Nix convention)
- Per-project claude-code pass-through to agentplot-kit profiles
- Auto-set `claude.config_dir = ".claude-${project_name}"` convention on both agent-deck and claude-code profiles
- Fix YAML output and Nix package build
- Explicitly require agentplot-kit for claude-code profiles
- Document in README with full examples

**Non-Goals:**
- CLI commands for managing projects imperatively — deferred
- Global agent-deck pass-through — users configure `programs.agent-deck` directly in their HM config
- Conductor/session layout configuration — handled by `configure-agent-deck-session` intent via shuffle
- Refactoring `programs.openspec` namespace — handled by `configure-agent-deck-session` intent
- Per-project agent-deck settings beyond `claude.config_dir` — upstream doesn't support it
- Contributing richer profiles to nix-agent-deck — separate effort

## Decisions

### D1: Rename "workspace" → "project" everywhere

All occurrences of "workspace" in the CodeCorral domain change to "project":

| Before | After |
|---|---|
| `WorkspaceConfig` | `ProjectConfig` |
| `CodeCorralConfig.workspaces` | `CodeCorralConfig.projects` |
| `workspaces:` (config.yaml key) | `projects:` |
| `agentDeckProfile` (config.yaml) | `agent_deck_profile` (snake_case) |
| `programs.codecorral.workspaces` | `programs.codecorral.projects` |
| `workspaceType` (Nix) | `projectType` |
| `codecorral workspaces` (CLI) | `codecorral projects` |
| `connection.onRequest("workspaces")` (daemon) | `connection.onRequest("projects")` |
| `src/cli/commands/workspaces.ts` | `src/cli/commands/projects.ts` |
| `workspace-config` (spec name) | `project-config` |

The README line "Workspace = workflow instance" becomes "Project = workflow instance."

Does NOT rename "workspace" in cmux-related contexts (e.g., `openspec/explorations/workflow-engine/domain-model.md` where "workspace" means cmux vertical tabs).

Config YAML uses snake_case throughout: `projects:`, `agent_deck_profile:`, `schemas_path:`.

### D2: Per-project delegation model

The CodeCorral HM module delegates per-project settings to upstream modules:

```nix
programs.codecorral = {
  enable = true;

  projects.my-project = {
    path = "/Users/chuck/Code/my-project";
    workflows = [ "intent" "unit" ];

    # Full pass-through to programs.claude_code.profiles.<name>
    claude_code = {
      settings.model = "claude-sonnet-4-6";
      agents.code-reviewer = {
        description = "Expert code review specialist";
        tools = [ "Read" "Grep" ];
        prompt = "You are an expert code reviewer.";
      };
      rules = [ "Always use conventional commits" ];
    };

    # Schemas union to programs.openspec.schemas; schemas_path stays in config.yaml
    openspec = {
      schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
      schemas_path = "./openspec/schemas";
    };
  };
};
```

Delegation map:

```
programs.codecorral.projects.<name>                 → programs.agent_deck.profiles.<name>.claude.config_dir  (convention)
programs.codecorral.projects.<name>.claude_code.*   → programs.claude_code.profiles.<name>.*  (full pass-through)
programs.codecorral.projects.<name>.openspec.schemas → programs.openspec.schemas  (union across all projects)
```

**Agent-deck is not proxied:** Users configure `programs.agent-deck` directly in their HM config for global settings (shell, docker, logs, MCPs, etc.). nix-agent-deck profiles only accept `claude.configDir` — conductor/session layout will be handled by the `configure-agent-deck-session` intent via shuffle deck YAML files.

**Claude-code is per-project:** agentplot-kit's claude-code module supports rich per-profile content (settings, agents, rules, skills, MCPs, hooks). Each project gets its own Claude identity and configuration.

### D3: Convention defaults with `lib.mkDefault`

Two conventions the module auto-sets:

1. **Profile name = project name.** `projects.foo` creates both `programs.agent_deck.profiles.foo` and `programs.claude_code.profiles.foo`.

2. **Shared `config_dir`.** Both get `config_dir = ".claude-${project_name}"` via `lib.mkDefault`, so they share the same Claude identity. Users can override with an explicit value.

Merge strategy for claude-code pass-through with the `config_dir` default:

```nix
programs.claude-code.profiles.${name} = lib.mkMerge [
  { config_dir = lib.mkDefault ".claude-${name}"; }
  proj.claude_code
];
```

`lib.mkMerge` combines the default and user values correctly — if the user sets `claude_code.config_dir`, it wins over `mkDefault`. For agent-deck profiles (which only have `claude.config_dir`):

```nix
programs.agent-deck.profiles.${name}.claude.config_dir =
  lib.mkDefault ".claude-${name}";
```

Duplicate profile assertion: if two projects produce the same name, `home-manager switch` fails.

### D4: Type strategy

- `programs.codecorral.projects.<name>.claude_code`: `lib.types.attrsOf lib.types.anything` — pass-through to agentplot-kit profile. CodeCorral doesn't validate; upstream module does. This means any new option added to agentplot-kit is immediately available without CodeCorral changes.
- `programs.codecorral.projects.<name>.openspec`: typed submodule with `schemas` (list of strings) and `schemas_path` (nullable string) — these have known shapes.

### D5: Fix YAML output

Replace `builtins.toJSON` with proper YAML generation. Two options by preference:

1. **`lib.generators.toYAML {}`** — pure Nix, no build-time dependency. Preferred if available in the target nixpkgs.
2. **`pkgs.formats.yaml {}`** — uses remarshal (Python), works reliably but pulls in a large closure. Use as fallback.

Note: `pkgs.formats.yaml` drags in Python + remarshal as transitive dependencies (nixpkgs#387673), which is heavyweight for a small config file. Prefer pure Nix generation.

### D6: Fix Nix package build

The current `packages.codecorral` uses `buildNpmPackage` with empty `npmDepsHash` and `npx tsc`. This is broken. Options:

1. **`bun2nix`** (`nix-community/bun2nix`) — provides `mkBunDerivation` for Bun projects. Preferred if it handles our dependency tree.
2. **`pkgs.stdenv.mkDerivation`** with `pkgs.bun` in `nativeBuildInputs` — manual but reliable. Run `bun build` in build phase.
3. **Keep `buildNpmPackage`** with Node.js for Nix build only — pragmatic if Bun sandbox issues arise (oven-sh/bun#24645: 0-byte binaries in Nix sandbox).

The wrapper script should use the appropriate runtime. Document Bun-in-Nix caveats.

### D7: Explicit agentplot-kit dependency

The module requires agentplot-kit's claude-code HM module for profile support. The upstream nix-community/home-manager module does NOT have `profiles`.

- Add `agentplot-kit` as a documented flake input (or document it as a required import)
- Guard claude-code delegation with `lib.mkIf (lib.hasAttrByPath ["programs" "claude-code" "profiles"] config)` — if profiles don't exist, skip delegation with a warning
- README must specify: "Requires agentplot-kit's claude-code module, not the upstream home-manager one"

### D8: README documentation

Add "Project Configuration via Home Manager" section covering:

1. Required flake inputs (codecorral, agentplot-kit, nix-agent-deck)
2. Module imports and `disabledModules` for upstream claude-code
3. Full project declaration example with claude-code agents/rules/skills and openspec schemas
4. Global agent-deck settings example (conductor, telegram, MCPs)
5. The two conventions (profile name, shared config_dir) and how to override
6. Note: `config.yaml` only contains engine-own state; tool config is delegated

### D9: Config.yaml contains engine-own state only

What goes in `config.yaml`:
- `path`, `workflows`, `agent_deck_profile` (string reference to the profile name), `openspec.schemas_path`

What does NOT go in `config.yaml`:
- Agent-deck settings (global or per-profile) — owned by nix-agent-deck
- Claude-code settings, agents, rules, skills — owned by agentplot-kit
- OpenSpec schema lists — owned by openspec HM module

The `codecorral projects` CLI displays: project name, path (with existence check), workflows, and agent-deck profile name. No tool-specific settings in CLI output.

## Risks / Trade-offs

**[Breaking config format]** → Existing `config.yaml` with `workspaces:` and camelCase keys stops loading. Mitigation: engine-core was just archived, no external users.

**[`attrsOf anything` loses type safety]** → Typos in pass-through sections surface at the upstream module, not at `programs.codecorral`. Mitigation: errors still appear at `home-manager switch` time.

**[Agent-deck not proxied]** → Users must configure `programs.agent-deck` directly. Conductor/session layout deferred to the `configure-agent-deck-session` intent (shuffle). If users need per-project agent-deck config beyond `claude.config_dir`, that requires upstream changes to nix-agent-deck.

**[agentplot-kit dependency]** → Users who only have the upstream claude-code module can't use profile delegation. Mitigation: guard with `lib.hasAttrByPath`, document the requirement, skip gracefully.

**[CLI visibility regression]** → `codecorral projects` no longer shows claude-code model or agent-deck details (those aren't in config.yaml). Mitigation: display the profile name as a reference; users consult their HM config for details.

**[Bun in Nix sandbox]** → Known issues with 0-byte binaries (bun#24645), AVX on macOS/Rosetta. Mitigation: fall back to Node.js for Nix build if needed.

**[YAML generation closure size]** → `pkgs.formats.yaml` pulls in Python/remarshal. Mitigation: prefer `lib.generators.toYAML` (pure Nix) if available.

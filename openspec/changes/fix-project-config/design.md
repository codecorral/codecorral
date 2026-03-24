## Context

The engine-core change shipped workspace configuration, a config loader, a `codecorral workspaces` CLI command, and a Home Manager module for declarative Nix configuration. However, the HM module has bugs that prevent it from functioning correctly: it uses `builtins.toJSON` to write a YAML file, the `codecorral` Nix package has a placeholder `npmDepsHash` that won't build, and the delegation model is incomplete — it should be a full pass-through composition layer for upstream modules (`programs.agent-deck`, `programs.claude-code`, `programs.openspec`) but currently only passes a thin slice of options.

Additionally, "workspace" collides with cmux's use of the term for vertical tabs. This needs to be renamed to "project" before the view-engine unit introduces cmux integration.

The CodeCorral HM module is a **composition layer**. When you declare a project, you're declaring "this project uses these tools with these settings" — and the module fans that out to the upstream modules. The upstream modules own their own config generation. CodeCorral's `config.yaml` only contains what the engine itself needs (path, workflows, profile name references).

## Goals / Non-Goals

**Goals:**
- Rename "workspace" → "project" consistently across all code, config, Nix, specs, and documentation (using snake_case per Nix convention)
- Make the HM module a full pass-through composition layer: anything the upstream modules accept can be set from within a project declaration
- Fix HM module to output proper YAML instead of JSON
- Fix the `codecorral` Nix package to actually build
- Document `homeManagerModules.codecorral` usage in README with full project declaration examples
- Establish two conventions: profile name = project name, shared `config_dir` = `.claude-${project_name}`

**Non-Goals:**
- CLI commands for managing projects imperatively (`codecorral projects add/remove/set`) — deferred to a future change
- Changing what the engine does with project config at runtime — projects remain declarative config that's read and displayed
- Changing the OpenSpec schemas HM module (`homeManagerModules.openspec`) — only the CodeCorral module changes

## Decisions

### D1: Rename "workspace" → "project" everywhere

All occurrences of "workspace" in the CodeCorral domain change to "project":

| Before | After |
|---|---|
| `WorkspaceConfig` | `ProjectConfig` |
| `CodeCorralConfig.workspaces` | `CodeCorralConfig.projects` |
| `workspaces:` (config.yaml key) | `projects:` |
| `programs.codecorral.workspaces` | `programs.codecorral.projects` |
| `workspaceType` (Nix) | `projectType` |
| `codecorral workspaces` (CLI) | `codecorral projects` |
| `src/cli/commands/workspaces.ts` | `src/cli/commands/projects.ts` |
| `workspace-config` (spec name) | `project-config` |

The README line "Workspace = workflow instance" becomes "Project = workflow instance."

This does not rename cmux workspaces (those stay as "workspaces") or any external tool terminology.

### D2: HM module as full pass-through composition layer

The CodeCorral HM module is a composition layer, not a config generator. Each project declaration contains three delegation sections that pass through **fully** to their upstream modules:

```nix
programs.codecorral.projects.my-project = {
  # ── CodeCorral-own (goes in config.yaml) ─────────────────
  path = "/Users/chuck/Code/my-project";
  workflows = [ "intent" "unit" ];

  # ── Full pass-through to programs.agent-deck ─────────────
  agent_deck = {
    claude = {
      # config_dir auto-set to ".claude-my-project" unless overridden
      dangerous_mode = true;
      env_file = "~/.claude.env";
    };
    shell = {
      env_files = [ "~/.agent-deck.env" ".env" ];
      init_script = "source ~/.zshrc";
    };
    conductor = {
      enable = true;
      extra_config = {
        auto_respond = true;
        telegram = {
          bot_token = "\${TELEGRAM_BOT_TOKEN}";
          chat_id = "\${TELEGRAM_CHAT_ID}";
        };
      };
    };
    mcps = {
      github = {
        command = "npx";
        args = [ "-y" "@modelcontextprotocol/server-github" ];
        env = { GITHUB_TOKEN = "\${GITHUB_TOKEN}"; };
      };
    };
    docker = {
      default_enabled = false;
      default_image = "ubuntu:22.04";
    };
    logs = { max_size_mb = 10; max_lines = 10000; };
    worktree.default_location = "sibling";
  };

  # ── Full pass-through to programs.claude-code ────────────
  claude_code = {
    # config_dir auto-set to ".claude-my-project" unless overridden
    settings = {
      model = "claude-sonnet-4-6";
      permissions.default_mode = "bypassPermissions";
    };
    agents = {
      code-reviewer = {
        description = "Expert code review specialist";
        proactive = true;
        tools = [ "Read" "Grep" ];
        prompt = "You are an expert code reviewer.";
      };
    };
    rules = [ "Always use conventional commits" ];
    skills = { };
  };

  # ── Delegated to programs.openspec ───────────────────────
  openspec = {
    schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
    schemas_path = "./openspec/schemas";  # stays in config.yaml (engine-local)
  };
};
```

The delegation logic:

```
project.agent_deck.*         → programs.agent_deck.profiles.<project_name>.*
  + auto-set claude.config_dir = ".claude-<project_name>" unless overridden

project.claude_code.*        → programs.claude_code.profiles.<project_name>.*
  + auto-set config_dir = ".claude-<project_name>" unless overridden

project.openspec.schemas     → programs.openspec.schemas (union across all projects)
project.openspec.schemas_path → stays in config.yaml (engine needs it, not openspec module)
```

**What goes in `config.yaml`** (engine-own state only):
- `path`, `workflows`, agent-deck profile name (reference), `openspec.schemas_path`

**What does NOT go in `config.yaml`**:
- agent-deck config, claude-code settings/agents/rules, openspec schemas — that's the upstream modules' business

### D3: Two conventions the module enforces

1. **Profile name = project name.** `projects.foo` creates `programs.agent_deck.profiles.foo` and `programs.claude_code.profiles.foo`. The user does not specify profile names separately — the project name IS the profile name.

2. **Shared `config_dir`.** Both agent-deck and claude-code get `config_dir = ".claude-${project_name}"` automatically, so they point at the same Claude identity. The user can override this if needed, but the default keeps them in sync.

The duplicate profile assertion remains: if two projects somehow produce the same profile name, `home-manager switch` fails with an assertion error.

### D4: Type strategy for pass-through sections

For `agent_deck` and `claude_code` pass-through sections, use `lib.types.attrsOf lib.types.anything` rather than re-declaring every upstream option as a typed submodule. This means:

- CodeCorral doesn't need to track upstream module schema changes
- Any new option added to `programs.agent-deck` or `programs.claude-code` is immediately available in project declarations
- No type validation at the CodeCorral level — the upstream module validates when it receives the options

The trade-off is weaker error messages (errors surface at the upstream module level, not at `programs.codecorral`). This is acceptable because the CodeCorral module is a thin composition layer, not an authority on upstream schemas.

### D5: Fix HM module YAML output

Replace `builtins.toJSON` with `pkgs.formats.yaml {}` for proper YAML generation:

```nix
yaml_format = pkgs.formats.yaml { };
home.file.".codecorral/config.yaml".source =
  yaml_format.generate "codecorral-config.yaml" { projects = project_entries; };
```

### D6: Fix Nix package build for Bun runtime

The current `packages.codecorral` uses `buildNpmPackage` with `npx tsc` and an empty `npmDepsHash`. Fix:

1. Use `pkgs.buildNpmPackage` with a proper `npmDepsHash` (or `pkgs.stdenv.mkDerivation` with Bun in `nativeBuildInputs`)
2. Build step uses Bun, not Node
3. Wrapper script uses the correct interpreter

### D7: README documentation section

Add a "Project Configuration via Home Manager" section to README covering:

1. Import `homeManagerModules.codecorral`
2. Declare projects with full `agent_deck`, `claude_code`, and `openspec` pass-through examples
3. Explain the two conventions (profile name, shared config_dir)
4. Note that `config.yaml` only contains engine-own state; tool config is delegated

## Risks / Trade-offs

**[Breaking config format]** → Any existing `config.yaml` with `workspaces:` key stops loading. Mitigation: engine-core was just archived, no external users yet.

**[`attrsOf anything` loses type safety]** → Upstream option typos won't be caught by CodeCorral's module. Mitigation: errors still surface at `home-manager switch` time from the upstream modules. Users who want type safety can also set options directly on `programs.agent-deck` / `programs.claude-code` outside CodeCorral.

**[`pkgs.formats.yaml` availability]** → Requires nixpkgs to include the YAML formatter. The current module signature already includes `pkgs`. If unavailable on older nixpkgs, fall back to JSON with a comment explaining why.

**[Bun in Nix sandbox]** → `pkgs.bun` may not be in all channels. Fall back to Node for the Nix build if needed.

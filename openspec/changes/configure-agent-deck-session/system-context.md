## System Landscape

Five systems participate in agent-deck session management today:

```
┌──────────────────────────────────────────────────────────┐
│                      User's Machine                       │
│                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌───────────────┐  │
│  │  agent-deck  │   │   shuffle    │   │ Home Manager   │  │
│  │  (Go TUI)   │   │  (Go CLI)   │   │  (Nix)        │  │
│  └──────┬──────┘   └──────┬──────┘   └───────┬───────┘  │
│         │                  │                   │          │
│         │    deal/diff     │    activation     │          │
│         │◄─────────────────┤◄──────────────────┤          │
│         │                  │                   │          │
│  ┌──────┴──────┐   ┌──────┴──────┐   ┌───────┴───────┐  │
│  │ ~/.agent-   │   │ deck YAML   │   │ nix config    │  │
│  │  deck/      │   │ (source of  │   │ (flake.nix +  │  │
│  │  config.toml│   │  truth)     │   │  hm-module)   │  │
│  └─────────────┘   └─────────────┘   └───────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                   codecorral repo                    │  │
│  │  openspec/schemas/  ·  decks/  ·  nix/hm-module.nix │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              nix-agent-deck repo                     │  │
│  │  modules/agent-deck.nix  (config.toml generation)   │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Context Boundary

**Inside** (systems being changed by this intent):

| System | Repo | What changes |
|--------|------|--------------|
| CodeCorral HM module | `codecorral` | Existing `programs.codecorral` (already has `projects`) gains `schemas` (migrated from `programs.openspec`) and deck profile management with shuffle activation |
| CodeCorral flake | `codecorral` | Adds shuffle as a flake input |
| Deck YAML | `codecorral` | New file: `decks/codecorral.deck.yaml` defining 6-group layout |
| Shuffle CLI | `shuffle` | Prerequisites delivered (shuffle#1-4 all closed) — no changes needed |

**Outside** (not changed, but interacted with):

| System | Repo | Relationship |
|--------|------|-------------|
| Agent-deck | `agent-deck` | Target of shuffle's `deal` command; provides the runtime for sessions/groups |
| Agent-deck HM module | `nix-agent-deck` | Generates `config.toml` independently; remains under `programs.agent-deck` |
| OpenSpec CLI | `openspec` | Consumes schemas installed by the HM module; unchanged |
| User's HM config | user-specific | Declares `programs.codecorral` options; triggers activation |

## Adjacent Systems

**Agent-deck** is the primary adjacent system. Shuffle translates deck YAML into agent-deck CLI calls (`agent-deck add`, `agent-deck group create`, `agent-deck mcp attach`). This intent does not change agent-deck itself, but depends on its CLI stability and profile support.

**nix-agent-deck** (`programs.agent-deck`) generates `~/.agent-deck/config.toml` — the global agent-deck configuration (default tool, shell settings, MCP definitions, docker, logs, etc.). The new `programs.codecorral` module operates at a higher layer: it manages what groups/sessions/conductors exist within a profile, not the global config. Both modules coexist in the same HM config. Note: `config.toml` is owned entirely by `programs.agent-deck` (Nix-generated, declarative). Shuffle's MCP definitions in deck YAML are applied via `agent-deck` CLI commands to the profile's state database, not by appending to `config.toml`.

**OpenSpec CLI** consumes schemas from `$XDG_DATA_HOME/openspec/schemas/`. The schema installation mechanism moves from `programs.openspec` to `programs.codecorral.schemas` but the output location and format are unchanged — OpenSpec is unaware of the refactor.

**Ralph-TUI** will eventually have sessions in the operations group, but this is out of scope for now. The operations group starts empty.

## Impact Analysis

**Data flow change — activation pipeline:**
```
Before:  HM switch → install schemas to XDG
After:   HM switch → install schemas to XDG
                    → for each profile:
                        for each deck:
                          shuffle deal --profile <name> <deck.yaml>
```

The activation pipeline gains a new stage. This is additive — the schema installation is unchanged.

**Namespace change — HM options:**
```
Before (current state after fix-project-config):
  programs.openspec.enable = true                              # separate module
  programs.openspec.schemas = [ ... ]                          # separate module
  programs.codecorral.enable = true                            # projects module
  programs.codecorral.projects.<name>.claude_code = { ... }    # per-project claude-code
  programs.codecorral.projects.<name>.openspec.schemas = [...]  # per-project schema union
  programs.agent-deck.enable = true                            # separate module

After (this intent):
  programs.codecorral.enable = true
  programs.codecorral.schemas = { ... }                        # migrated from programs.openspec
  programs.codecorral.projects.<name>.claude_code = { ... }    # unchanged
  programs.codecorral.projects.<name>.openspec.schemas = [...]  # unchanged
  programs.codecorral.<decks TBD — namespace needs exploration>
  programs.agent-deck.enable = true                            # unchanged
```

NOTE: The exact namespace for deck profile configuration needs exploration. Options
include `programs.codecorral.profiles.<name>.decks`, `programs.codecorral.decks.<name>`,
or integrating with `programs.codecorral.projects.<name>`. See exploration notes.

This is a breaking change for existing users of `programs.openspec`. Migration uses `mkRenamedOptionModule` to provide deprecation warnings and automatic option forwarding during a transition period.

**Deck YAML relocation:**
```
Before:  shuffle/codecorral.deck.yaml  (in shuffle repo)
After:   codecorral/decks/codecorral.deck.yaml  (in codecorral repo)
```

The deck moves to where its content is owned. The shuffle repo retains example decks for documentation but loses the codecorral-specific one.

**Profile decoupling:**
```
Before:  profile.name embedded in deck YAML
After:   profile provided via --profile CLI flag (deck is profile-agnostic)
```

## Technical Landscape

- **Nix ecosystem**: Flakes, Home Manager modules, `buildGoModule` for Go packaging. All repos use flakes.
- **Go**: Shuffle is Go 1.18+, minimal dependencies (BurntSushi/toml, gopkg.in/yaml.v3). Standard `buildGoModule` packaging.
- **Agent-deck**: Go + Bubble Tea TUI. Profiles stored at `~/.agent-deck/profiles/<name>`. CLI is the integration surface — no library API.
- **Shuffle semantics**: Additive-only (verified — no delete code exists), idempotent (verified — diff layer + apply guards). Best-effort apply with silent error swallowing (shuffle#3 to fix). Empty groups verified OK in shuffle parser; agent-deck `group create` acceptance needs runtime testing.
- **HM activation**: Scripts run synchronously during `home-manager switch` with `set -e`. Any non-zero exit aborts the entire switch. Activation must wrap shuffle calls with `|| { warn; }` and use `entryAfter ["writeBoundary"]` for ordering. Must respect `$DRY_RUN_CMD`.

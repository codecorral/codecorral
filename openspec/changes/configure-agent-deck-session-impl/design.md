## Context

The CodeCorral HM module (`programs.codecorral`) currently handles per-project claude-code delegation and agent-deck `config_dir` convention (from fix-project-config). Schema distribution lives in a separate `programs.openspec` module. There's no mechanism to declaratively provision agent-deck session layouts.

Shuffle (`codecorral/shuffle`) is a Go CLI that applies deck YAML files to agent-deck idempotently via `shuffle deal`. All prerequisites are done (issues #1-4 closed): `--profile` flag, Nix packaging, error handling, file path resolution.

This change consolidates the HM module into a single `programs.codecorral` namespace and adds automatic deck provisioning.

## Goals / Non-Goals

**Goals:**
- Migrate `programs.openspec` into `programs.codecorral.schemas` with backwards-compatible deprecation
- Remove premature per-project `openspec` options from the project type
- Author the 6-group AI-DLC deck YAML with conductor definitions
- Add shuffle as a flake input and bundle the deck as a Nix derivation
- Add HM activation script that runs `shuffle deal` per project automatically

**Non-Goals:**
- User-configurable deck options — the layout is fixed, CodeCorral applies it behind the scenes
- Per-project deck customization — all projects get the same 6-group layout
- Variable substitution or templating in deck YAML
- Deletion/cleanup semantics for removed sessions (shuffle is additive-only)
- Changes to shuffle CLI itself (all prerequisites done)

## Decisions

### D1: Schema migration with `mkRenamedOptionModule`

Move schema distribution from `programs.openspec` to `programs.codecorral.schemas`:

```nix
# Before (separate module):
programs.openspec.enable = true;
programs.openspec.schemas = [ "dev.codecorral.intent@2026-03-11.0" ];

# After (unified):
programs.codecorral.enable = true;
programs.codecorral.schemas = [ "dev.codecorral.intent@2026-03-11.0" ];
```

Implementation: fold the `nix/hm-module.nix` logic (schema selection, `xdg.dataFile` generation) into `nix/codecorral-hm-module.nix`. Add `mkRenamedOptionModule` so `programs.openspec.schemas` forwards to `programs.codecorral.schemas` with a deprecation warning. The `homeManagerModules.openspec` flake export becomes an alias.

The `schemaPackage` option moves too — it needs access to the flake's `self` for the default value. The module function signature changes from `{ config, lib, pkgs, ... }:` to receiving `flake:` as a curried argument (matching the existing `hm-module.nix` pattern).

### D2: Remove per-project openspec from project type

The current `projectType` has an `openspec` submodule with `schemas` and `schemas_path`. These are premature — schemas are global, not per-project. Remove:

- `openspec` option from `projectType` in the HM module
- `allSchemas` union logic
- `openspec.schemas_path` from config.yaml generation
- `openspec_schemas_path` from TypeScript `ProjectConfig` type
- Per-project openspec delegation block

### D3: Deck YAML authoring

Create `decks/codecorral.deck.yaml` defining the standard 6-group AI-DLC session layout:

```yaml
name: codecorral
groups:
  clint:
    conductors:
      foreman:
        description: "Primary conductor — polls task board, delegates work"
        claude_md: ./conductors/foreman.md
    sessions: {}
  exploration:
    sessions: {}
  backlogs:
    sessions: {}
  elaboration:
    sessions: {}
  construction:
    sessions: {}
  operations:
    sessions: {}
```

Groups start minimal — sessions within groups are created dynamically by the conductor at runtime, not pre-defined in the deck. The deck establishes the group structure and the foreman conductor. Empty groups are valid in shuffle.

Conductor `.md` files live in `decks/conductors/`. The deck YAML references them via relative paths — shuffle resolves these from the deck file's directory (shuffle#4).

### D4: Shuffle flake input and deck derivation

Add shuffle to `flake.nix` inputs:

```nix
inputs.shuffle.url = "github:codecorral/shuffle";
```

Bundle the deck YAML and its referenced files as a Nix derivation:

```nix
packages.codecorral-deck = pkgs.runCommand "codecorral-deck" { } ''
  mkdir -p $out
  cp -r ${./decks}/* $out/
'';
```

The HM module references this derivation to get the Nix store path for `shuffle deal`.

### D5: HM activation script

Add a DAG entry to `home.activation` that runs `shuffle deal` for each project:

```nix
home.activation.codecorral-deck = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
  ${lib.optionalString (cfg.projects != { }) ''
    for profile in ${lib.concatStringsSep " " (lib.attrNames cfg.projects)}; do
      $DRY_RUN_CMD ${shuffle}/bin/shuffle deal \
        --profile "$profile" \
        ${deckDerivation}/codecorral.deck.yaml \
        || $VERBOSE_ECHO "warning: shuffle deal failed for profile $profile"
    done
  ''}
'';
```

Key requirements:
- `entryAfter ["writeBoundary"]` — deck files must be in place before shuffle runs
- `$DRY_RUN_CMD` — respects `home-manager switch --dry-run`
- `|| warn` — swallows failures (shuffle or agent-deck not running) to avoid aborting `home-manager switch`
- Only runs if projects are configured

### D6: Unified module function signature

The current `codecorral-hm-module.nix` uses `{ config, lib, pkgs, ... }:`. To access the flake's schema package (needed for schema distribution), it needs the flake reference. Follow the existing `hm-module.nix` pattern: the flake exports a curried function `flake: { config, lib, pkgs, ... }:` and the flake passes `self`:

```nix
homeManagerModules.codecorral = import ./nix/codecorral-hm-module.nix self;
```

## Risks / Trade-offs

**[`mkRenamedOptionModule` deprecation noise]** → Users see warnings on every `home-manager switch` until they migrate. Mitigation: warnings are informative and the old options keep working.

**[Shuffle not installed]** → If agent-deck or shuffle isn't on PATH during activation, `shuffle deal` fails. Mitigation: error is swallowed with warning; activation continues.

**[Empty groups in agent-deck]** → Verified OK in shuffle's parser. Agent-deck's `group create` acceptance needs runtime testing. Mitigation: if it fails, shuffle's error handling returns non-zero, which the wrapper catches.

**[Deck YAML in Nix store is immutable]** → Users can't edit the deck layout. Mitigation: this is intentional — the layout is CodeCorral's opinion, not user-configurable.

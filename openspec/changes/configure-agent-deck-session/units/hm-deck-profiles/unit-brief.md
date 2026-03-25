## Unit: hm-deck-profiles

**Description:** Add `programs.codecorral.profiles.<name>.decks` option to the CodeCorral HM module. On `home-manager switch`, the activation script runs `shuffle deal --profile <name> <deck.yaml>` for each configured deck, creating agent-deck groups/sessions/conductors declaratively. Supports multiple profiles and multiple decks per profile (layering).

**Deliverable:** HM module option `programs.codecorral.profiles` with deck list, activation script that runs shuffle, and shuffle as a flake input. Users can declare deck profiles in Nix and have agent-deck sessions created automatically on `home-manager switch`.

**Dependencies:** openspec-namespace-migration (the `programs.codecorral` module must have the unified namespace before adding profiles), deck-yaml-authoring (need at least one deck YAML to test against)

## Relevant Requirements

- UC1 (First-time setup): On `home-manager switch`, `shuffle deal --profile codecorral` runs, creating all 6 groups
- UC2 (Layout evolution): Developer pulls deck update, runs `home-manager switch`, shuffle applies changes additively
- UC3 (Multi-profile): Two profiles each pointing at different deck files, both applied on activation
- UC4 (Deck layering): Base deck + project deck layer into the same profile
- NFR (Graceful degradation): If agent-deck is not running or shuffle fails, activation must not fail. Wrap with `|| { warn; }`
- NFR (Activation speed): Shuffle deal completes in seconds
- NFR (Activation ordering): Must use `lib.hm.dag.entryAfter ["writeBoundary"]` so deck files exist before shuffle runs
- NFR (File path integrity): Deck YAML references to conductor `.md` files must resolve from Nix store
- Constraint: Must respect `$DRY_RUN_CMD` for `home-manager switch --dry-run`
- Constraint: Deck options must use `types.path` (not `types.str`) for Nix store copy and reproducibility
- Constraint: Two decks with the same session name in the same group silently collide — no merge detection

## System Context

- `nix/codecorral-hm-module.nix` is the target file — gains a `profiles` option alongside existing `projects`
- `flake.nix` needs `shuffle` as a flake input so the activation script can call it
- Activation scripts are HM DAG entries run during `home-manager switch` with `set -e`
- Shuffle's `--profile` flag (issue #1, closed) binds the deck to an agent-deck profile at deal-time
- Shuffle's file path resolution (issue #4, closed) handles Nix store paths

## Scope Boundaries

**In scope:**
- Add `programs.codecorral.profiles.<name>.decks` option (list of `types.path`)
- Add shuffle as a flake input (`buildGoModule` from `codecorral/shuffle`)
- Implement HM activation script: iterate profiles × decks, run `shuffle deal --profile <name> <deck>`
- Activation ordering via `entryAfter ["writeBoundary"]`
- Error wrapping: `|| { warn "shuffle failed for profile <name>"; }`
- Dry-run support: check `$DRY_RUN_CMD`
- Tests: verify activation script generates correct commands

**Out of scope:**
- Deck YAML content (separate unit)
- Schema distribution (separate unit)
- Deletion/cleanup semantics for removed sessions (shuffle is additive-only)
- Variable substitution in deck YAML
- Changes to shuffle CLI itself (prerequisites done)

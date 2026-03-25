## Problem Statement

Setting up and maintaining agent-deck session layouts for AI-DLC projects requires manual CLI invocations — creating groups, configuring sessions, attaching MCPs — that drift from the intended layout over time. There is no declarative source of truth for the 6-group session layout that CodeCorral defines, and no automated mechanism to keep agent-deck in sync with that layout.

Additionally, the Home Manager integration has a namespace split: `programs.openspec` handles schema distribution separately from `programs.codecorral` (which now manages per-project claude-code delegation and agent-deck profile conventions after the fix-project-config change). There is no unified namespace for all CodeCorral HM concerns (schemas + projects + deck profiles).

## Desired Outcome

A deck YAML file in the codecorral repo defines the 6-group AI-DLC session layout as the source of truth. The existing `programs.codecorral` Home Manager module (which already handles per-project claude-code delegation) gains two additions: OpenSpec schema distribution (migrated from `programs.openspec`) and deck profile management. The module runs `shuffle deal --profile <name>` during HM activation to apply deck files. Users declare which deck files map to which agent-deck profiles in their Nix configuration, and Home Manager keeps everything in sync on `home-manager switch`.

The shuffle CLI supports a `--profile` flag so deck YAML files remain profile-agnostic — the profile binding happens at the HM layer, not in the deck file. Multiple deck files can layer into the same profile.

## Scope

**In scope:**
- Define the 6-group deck YAML (`codecorral.deck.yaml`) with groups: clint, exploration, backlogs, elaboration, construction, operations
- Migrate `programs.openspec` schema distribution into the existing `programs.codecorral` module as a `schemas` sub-option
- HM activation script that runs `shuffle deal --profile <name>` for each configured deck
- Support multiple deck profiles in HM configuration (e.g., codecorral, personal)
- Move `codecorral.deck.yaml` from the shuffle repo to the codecorral repo
- Add shuffle as a flake input (Nix packaging, `--profile` flag, error handling, and file path resolution are all done — shuffle#1-4 closed)
- Deck YAML and all referenced files (conductor `.md` files) must be bundled together in a single Nix derivation
- Use `mkRenamedOptionModule` for backwards-compatible migration from `programs.openspec`
- HM activation script must use `entryAfter ["writeBoundary"]`, respect `$DRY_RUN_CMD`, and swallow failures with warnings

**Out of scope:**
- Variable substitution / templating in deck YAML (postponed)
- Ralph-TUI session configuration (operations group starts empty)
- Changes to the `nix-agent-deck` module (`programs.agent-deck` remains separate)
- Shuffle's internal apply/diff logic beyond the `--profile` flag and error handling fix
- Deletion or cleanup semantics for removed sessions/groups (shuffle is additive-only)

## Stakeholders

- **AI-DLC practitioners** — users bootstrapping and maintaining CodeCorral projects who need agent-deck sessions configured consistently
- **CodeCorral maintainers** — responsible for the deck layout definition and HM module
- **Shuffle maintainers** — prerequisites delivered (shuffle#1-4 closed)

## Constraints

- Shuffle prerequisites are all delivered (shuffle#1 `--profile`, #2 Nix packaging, #3 error handling, #4 file path resolution — all closed as of 2026-03-24)
- Shuffle is additive-only — it never deletes existing sessions/groups, so layering multiple decks is safe but removal requires manual intervention. Group renaming creates orphans (new group + stale old group).
- HM activation scripts run synchronously with `set -e` — shuffle failures would abort `home-manager switch`. Activation must wrap calls with error tolerance (`|| { warn; }`)
- The `programs.agent-deck` module in `nix-agent-deck` repo remains the generic engine; `programs.codecorral` provides project-specific opinions on top
- Empty groups (exploration, backlogs, operations) verified OK in shuffle's parser/diff layer; agent-deck's `group create` acceptance needs runtime testing
- Deck options must use `types.path` (not `types.str`) to ensure Nix store copy and reproducibility
- Two decks defining the same session name in the same group will silently collide — second deck's version is skipped. No merge or conflict detection exists.

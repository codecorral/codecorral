## User Stories

- As an AI-DLC practitioner, I want to run `home-manager switch` and have my agent-deck sessions configured automatically, so that I don't have to manually create groups and sessions via CLI.

- As a CodeCorral maintainer, I want the 6-group session layout defined in a single deck YAML file in the codecorral repo, so that the layout is version-controlled and reviewable.

- As a user with multiple projects, I want to define separate deck profiles in my Nix config (e.g., codecorral, personal), so that each project gets its own agent-deck layout without conflicts.

- As a user, I want to layer multiple deck files into the same profile, so that I can compose layouts from modular pieces (base + project-specific additions).

- As a user managing my Nix config, I want schemas and deck profiles under a single `programs.codecorral` namespace, so that I have one cohesive import for all CodeCorral concerns.

## Use Cases

**UC1: First-time setup**
A developer adds `programs.codecorral` to their Home Manager config, points it at the codecorral deck YAML, and specifies a profile name. On `home-manager switch`, schemas are installed to XDG data dirs and `shuffle deal --profile codecorral` runs, creating all 6 groups in agent-deck. The developer opens agent-deck and sees clint, exploration, backlogs, elaboration, construction, and operations groups ready to use.

**UC2: Layout evolution**
The codecorral team updates the deck YAML — adding an MCP to the elaboration shell or a new session to the backlogs group. A developer pulls the update, runs `home-manager switch`, and shuffle applies the changes additively. Existing sessions are untouched; new ones appear.

**UC3: Multi-profile management**
A developer uses codecorral for work and has a personal deck for side projects. Their Nix config defines two profiles, each pointing at different deck files. Both are applied on activation, each targeting its own agent-deck profile. Switching between them in agent-deck is seamless.

**UC4: Deck layering**
A team has a base deck shared across all members and project-specific decks per repo. A developer's profile lists both — the base deck is applied first, then the project deck layers additional groups/sessions on top.

## Non-Functional Requirements

- **Idempotency**: Running `home-manager switch` multiple times with no config changes must produce no side effects in agent-deck.

- **Graceful degradation**: If agent-deck is not running or not on PATH during HM activation, the activation must not fail. The activation script wraps shuffle calls with `|| { warn; }` to prevent `set -e` from aborting `home-manager switch`. Shuffle itself should also report failures via non-zero exit codes (codecorral/shuffle#3) so the wrapper can log meaningful warnings.

- **Activation speed**: Shuffle deal should complete in seconds, not minutes. HM activation should not be noticeably slower with deck profiles enabled.

- **Activation ordering**: Deck activation must run after `writeBoundary` (via `lib.hm.dag.entryAfter`) to ensure all file artifacts (schemas, deck YAML in Nix store) are in place. Must also respect `$DRY_RUN_CMD` for `home-manager switch --dry-run`.

- **Additive safety**: Since shuffle is additive-only, layering multiple decks must never clobber existing sessions or groups. Users should understand that removal of sessions requires manual intervention. Group renaming will create orphans — the old group persists alongside the new one.

- **File path integrity**: Deck YAML files that reference external files (e.g., `claude_md: ./conductors/foreman.md`) must have those files bundled in the same Nix derivation. The HM module must ensure referenced files are co-located with the deck YAML in the Nix store, or shuffle must support a `--base-path` override (codecorral/shuffle#4).

- **Backwards compatibility**: Migration from `programs.openspec` to `programs.codecorral.schemas` must use `mkRenamedOptionModule` to provide deprecation warnings rather than breaking existing configs silently.

## Boundaries

- No variable substitution or templating in deck YAML — decks are static files for now
- No ralph-tui session configuration — operations group starts empty
- No conductor markdown file authoring — conductor `.md` files are referenced in the deck but authored separately
- No changes to `programs.agent-deck` (`nix-agent-deck` repo) — it remains the generic config.toml generator
- No shuffle internal changes — all prerequisites delivered (shuffle#1-4 closed)
- No deletion or cleanup semantics — shuffle is additive-only, removing sessions requires manual `agent-deck` CLI usage
- No collision detection for layered decks — two decks defining the same session name in the same group will silently skip the second definition

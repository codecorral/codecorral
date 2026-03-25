## Unit: deck-yaml-authoring

**Description:** Author the `codecorral.deck.yaml` file that defines the 6-group AI-DLC session layout (clint, exploration, backlogs, elaboration, construction, operations) with conductor sessions, MCP attachments, and session configuration. This is the declarative source of truth for the standard CodeCorral agent-deck layout.

**Deliverable:** `decks/codecorral.deck.yaml` file in the codecorral repo, bundled as a Nix derivation so the HM module can reference it from the Nix store. Includes conductor `.md` files referenced by the deck.

**Dependencies:** None (can be done in parallel with other units; the HM module unit consumes this but the YAML can be authored and tested with `shuffle validate`/`shuffle diff` independently)

## Relevant Requirements

- UC1 (First-time setup): Developer opens agent-deck and sees clint, exploration, backlogs, elaboration, construction, and operations groups ready to use
- UC2 (Layout evolution): The codecorral team updates the deck YAML — adding an MCP or a new session — and shuffle applies changes additively
- NFR (Idempotency): Running `shuffle deal` multiple times with no changes produces no side effects
- NFR (Additive safety): Layering multiple decks never clobbers existing sessions/groups
- Constraint: Empty groups (exploration, backlogs, operations) must be valid in shuffle's parser
- Constraint: Deck YAML and all referenced files (conductor `.md` files) must be bundled in a single Nix derivation

## System Context

- Shuffle parses `.deck.yaml` files and translates them into agent-deck CLI calls (`agent-deck add`, `agent-deck group create`, `agent-deck mcp attach`)
- The deck YAML was previously in the shuffle repo — this unit moves it to the codecorral repo where its content is owned
- `shuffle validate` and `shuffle diff` can test the YAML without applying it
- The deck file must be profile-agnostic — the `--profile` flag at deal-time binds it to a profile

## Scope Boundaries

**In scope:**
- Author `decks/codecorral.deck.yaml` with 6 groups and their sessions
- Author conductor `.md` files referenced by the deck (e.g., `decks/conductors/foreman.md`)
- Create a Nix derivation in `flake.nix` that bundles the deck + referenced files
- Verify with `shuffle validate` and `shuffle diff`

**Out of scope:**
- Ralph-TUI sessions in the operations group (starts empty)
- Variable substitution or templating in deck YAML
- The HM activation script (separate unit)
- Shuffle CLI changes (prerequisites already done: #1, #2, #3, #4)

## ADDED Requirements

### Requirement: Bundled deck YAML defines AI-DLC session layout
The CodeCorral repo SHALL contain a deck YAML file (`decks/codecorral.deck.yaml`) that defines the standard 6-group AI-DLC session layout: clint, exploration, backlogs, elaboration, construction, and operations. The deck SHALL include a foreman conductor in the clint group. The deck and its referenced files (conductor `.md` files) SHALL be bundled as a Nix derivation.

#### Scenario: Deck YAML validates
- **WHEN** `shuffle validate decks/codecorral.deck.yaml` is run
- **THEN** the deck YAML passes validation with no errors

#### Scenario: Deck defines 6 groups
- **WHEN** the deck YAML is parsed
- **THEN** it contains groups: clint, exploration, backlogs, elaboration, construction, operations

#### Scenario: Foreman conductor defined
- **WHEN** the deck YAML is parsed
- **THEN** the clint group contains a conductor named foreman with a referenced `.md` file

#### Scenario: Deck bundled as Nix derivation
- **WHEN** the Nix flake is built
- **THEN** `packages.codecorral-deck` contains the deck YAML and all referenced conductor files

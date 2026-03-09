## ADDED Requirements

### Requirement: Pool model for inception sessions
The system SHALL provide a pool of pre-created long-lived AgentDeck sessions for inception mob elaboration. Pool size SHALL be developer-controlled (e.g., 1-3 concurrent inception sessions). The conductor dispatches work into idle sessions via `agent-deck session send`.

#### Scenario: Pool creation
- **WHEN** the conductor initializes the inception pool
- **THEN** it SHALL create the configured number of AgentDeck sessions in the Ideation phase group, each in idle state

#### Scenario: Work dispatch to idle session
- **WHEN** the conductor has an inception bead to process and an idle pool session exists
- **THEN** it SHALL dispatch the inception prompt to the idle session via `agent-deck session send <session-id> "<prompt>"`
- **AND** the session SHALL transition from idle to active

#### Scenario: No idle sessions available
- **WHEN** the conductor has an inception bead to process but all pool sessions are active
- **THEN** it SHALL queue the bead until a session becomes idle

### Requirement: Phase-based session groups
AgentDeck sessions SHALL be organized into four named phase groups: Ideation, Elaboration, Review, and Construction. The conductor SHALL place sessions into the appropriate group when creating or launching them.

#### Scenario: Session group assignment
- **WHEN** the conductor creates a pool session for inception
- **THEN** the session SHALL appear in the Ideation group

#### Scenario: Ralph session group assignment
- **WHEN** the conductor launches Ralph for a Loop 2 epic
- **THEN** the resulting sessions SHALL appear in the Elaboration group

#### Scenario: Construction session group assignment
- **WHEN** the conductor launches Ralph for a Loop 3 epic
- **THEN** the resulting sessions SHALL appear in the Construction group

### Requirement: TuiCR review session lifecycle
At the end of each agent run (pool session completion or Ralph run completion), a TuiCR session SHALL be dynamically created in the Review group. The session presents the `REVIEW-SUMMARY.md` produced by the AI mob's review curation phase — a focused list of items that survived automated verification but still need human judgment.

#### Scenario: TuiCR after inception
- **WHEN** an inception pool session completes (bead closed)
- **THEN** a TuiCR session SHALL be created in the Review group presenting the `REVIEW-SUMMARY.md` from the inception artifacts, with navigation to each flagged section

#### Scenario: TuiCR after bolt elaboration
- **WHEN** a bolt-elaboration bead completes
- **THEN** a TuiCR session SHALL be created in the Review group presenting the `REVIEW-SUMMARY.md` from the bolt change's artifacts, with navigation to each flagged section

#### Scenario: Approval gates next phase
- **WHEN** the developer approves a TuiCR review
- **THEN** the conductor SHALL proceed with the next loop transition (Loop 1→2 or Loop 2→3)

#### Scenario: Rejection triggers re-iteration
- **WHEN** the developer rejects a TuiCR review with feedback
- **THEN** the conductor SHALL re-dispatch the work with the feedback appended to the prompt

#### Scenario: Asynchronous stakeholder routing
- **WHEN** a `REVIEW-SUMMARY.md` contains items tagged with specific reviewer roles (e.g., `reviewer: product-owner`)
- **THEN** the system SHALL support notifying the relevant stakeholders about their tagged review items

### Requirement: Session teardown on epic completion
The conductor SHALL tear down sessions when an epic's beads are all closed, freeing resources.

#### Scenario: Elaboration session teardown
- **WHEN** all beads in a bolt epic are closed
- **THEN** the conductor SHALL tear down the Elaboration group sessions for that epic

#### Scenario: Pool session return to idle
- **WHEN** an inception bead is closed
- **THEN** the pool session SHALL return to idle (not torn down) for reuse

## ADDED Requirements

### Requirement: defineLayout builder function
The system SHALL export a `defineLayout(config: LayoutConfig): LayoutConfig` function that declares a view layout with workspace metadata, pane definitions, and panel configurations. The function SHALL accept both static panel arrays and dynamic panel functions that receive a `LayoutContext`.

#### Scenario: Static panel list
- **WHEN** `defineLayout` is called with a `panels` array
- **THEN** the returned layout config contains the panels as-is

#### Scenario: Dynamic panel function
- **WHEN** `defineLayout` is called with a `panels` function
- **THEN** the function is stored and evaluated later when `resolveLayout` is called with a concrete `LayoutContext`

#### Scenario: Type validation
- **WHEN** `defineLayout` is called with a panel missing the required `role` field
- **THEN** TypeScript compilation fails with a type error

### Requirement: Pane grouping
A layout SHALL declare panes as named split regions. Each pane SHALL have a unique `pane` name and a `region` value (`"main"`, `"right"`, `"down"`, `"left"`, `"up"`). Panels SHALL reference a pane by name via their `pane` field. Multiple panels with the same `pane` value SHALL become tabs/surfaces within that single split region.

#### Scenario: Single panel per pane
- **WHEN** a layout declares one pane "editor" with region "main" and one panel with `pane: "editor"`
- **THEN** resolution produces one split region containing one surface

#### Scenario: Multiple panels per pane (tabbed)
- **WHEN** a layout declares one pane "conductors" with region "main" and three panels with `pane: "conductors"`
- **THEN** resolution produces one split region containing three surfaces as tabs, each with its own label

#### Scenario: Panels reference non-existent pane
- **WHEN** a resolved layout contains a panel whose `pane` value does not match any declared pane
- **THEN** the system logs a warning and skips the orphaned panel

### Requirement: Panel configuration
Each panel SHALL have a unique `role` (string identifier), a `type` (`"terminal"` or `"browser"`), and a `pane` reference. Terminal panels SHALL accept an optional `command` string. Browser panels SHALL accept an optional `url` string. All panels SHALL accept an optional `label` string for display as a tab label (defaults to the role name).

#### Scenario: Terminal panel with command
- **WHEN** a terminal panel is resolved with `command: "agent-deck session attach conductor-main"`
- **THEN** the view engine sends the command text to the created surface via `sendText`

#### Scenario: Browser panel with URL
- **WHEN** a browser panel is resolved with `url: "https://example.com/board"`
- **THEN** the view engine opens a browser split and navigates to the URL

#### Scenario: Panel without command or URL
- **WHEN** a terminal panel is resolved without a `command` value
- **THEN** the view engine creates the surface but sends no text (empty shell)

### Requirement: LayoutContext with workspace and optional workflow
The `LayoutContext` type SHALL provide a `workspace` field (always present) containing the resolved workspace configuration, and an optional `workflow` field containing workflow runtime state (workflowId, instanceId, phase, sessionTitle, changePath, worktreePath, branch, baseBranch, prUrl). Dynamic panel functions SHALL receive this context to generate panels based on runtime state.

#### Scenario: Command center uses workspace context
- **WHEN** a command center layout function receives a `LayoutContext`
- **THEN** `ctx.workspace` is populated with conductor list and board URL, and `ctx.workflow` is undefined

#### Scenario: Workflow view uses both contexts
- **WHEN** a workflow phase layout function receives a `LayoutContext`
- **THEN** `ctx.workspace` is populated with workspace config and `ctx.workflow` is populated with the current workflow instance's runtime state

### Requirement: defineOverlay builder function
The system SHALL export a `defineOverlay(base: string, config: OverlayConfig): OverlayConfig` function that declares add/remove/override deltas against a named base layout. The overlay SHALL support adding panels, removing panels by role, overriding panel properties by role, adding panes, and removing panes.

#### Scenario: Overlay adds a panel
- **WHEN** an overlay with `add: [{ role: "tests", type: "terminal", pane: "log", command: "bun test --watch" }]` is resolved against a base layout
- **THEN** the resolved layout includes all base panels plus the "tests" panel

#### Scenario: Overlay removes a panel
- **WHEN** an overlay with `remove: ["board"]` is resolved against a base layout that has a panel with role "board"
- **THEN** the resolved layout excludes the "board" panel but retains all other base panels

#### Scenario: Overlay overrides panel properties
- **WHEN** an overlay with `override: { "agent": { pane: "right-side" } }` is resolved against a base layout
- **THEN** the "agent" panel's `pane` value is changed to "right-side" and all other properties are preserved

#### Scenario: Overlay adds a pane
- **WHEN** an overlay with `panes: { add: [{ pane: "extras", region: "down" }] }` is resolved
- **THEN** the resolved layout includes the "extras" pane in addition to all base panes

### Requirement: resolveLayout merges base and overlay
The system SHALL export a `resolveLayout(base: LayoutConfig, overlay: OverlayConfig | null, ctx: LayoutContext): ResolvedLayout` function. Resolution SHALL evaluate dynamic panel functions, then apply overlay operations in order: remove panels, remove panes, apply overrides, add panes, add panels. The returned `ResolvedLayout` SHALL contain the final pane list and panel list ready for reconciliation.

#### Scenario: No overlay
- **WHEN** `resolveLayout` is called with a base layout and null overlay
- **THEN** the base panels are evaluated (if dynamic) and returned as-is

#### Scenario: Overlay composition preserves base updates
- **WHEN** a base layout is updated to include a new panel "metrics" and an existing overlay only adds a "tests" panel
- **THEN** resolution produces a layout with both the new "metrics" panel and the overlay's "tests" panel

#### Scenario: Invalid overlay produces warnings
- **WHEN** an overlay removes a role that doesn't exist in the base layout
- **THEN** the system logs a warning and continues resolution without error

### Requirement: State machine view integration
Workflow state machines SHALL reference view layouts via `state.meta.view`. The view engine SHALL read `state.meta.view` after each state transition. If the view layout changed, the view engine SHALL call `resolveLayout` with the base view, any applicable overlay, and the current `LayoutContext`, then feed the result to the reconciliation algorithm.

#### Scenario: Phase transition changes view
- **WHEN** a workflow transitions from "elaboration" to "review" and each state has a different `meta.view`
- **THEN** the view engine resolves the new layout and reconciles the workspace (renaming, adding/removing surfaces)

#### Scenario: State with no view
- **WHEN** a workflow transitions to a state that has no `meta.view`
- **THEN** the view engine closes the workflow's workspace (e.g., on completion to a final state)

#### Scenario: Same view across states
- **WHEN** two consecutive states reference the same layout object
- **THEN** the view engine skips reconciliation (no-op)

### Requirement: Overlay file discovery for state machine views
The system SHALL discover overlay files for state machine views by machine ID. The discovery order SHALL be: `.codecorral/views/{machineId}.ts` (project-local), then `~/.codecorral/views/{machineId}.ts` (user-global). The first found file SHALL be loaded via dynamic import. The file SHALL export a default record keyed by state name, where each value is an `OverlayConfig`.

#### Scenario: Project-local overlay exists
- **WHEN** `.codecorral/views/unit-workflow.ts` exists and exports `{ implementation: defineOverlay(...) }`
- **THEN** the view engine applies the overlay when the "implementation" state's view is resolved

#### Scenario: No overlay file exists
- **WHEN** no overlay file exists for a machine ID
- **THEN** the view engine uses the base view from `state.meta.view` as-is

#### Scenario: Overlay targets non-existent state
- **WHEN** an overlay file exports a key "deprecated-state" that does not exist in the machine
- **THEN** the system logs a warning at overlay load time and ignores that key

### Requirement: codecorral view fork command
The CLI SHALL provide `codecorral view fork <layout-name>` to scaffold an overlay file into `.codecorral/views/`. By default, the command SHALL create an empty overlay with correct imports, type annotations, and comments showing available roles. With the `--full` flag, the command SHALL copy the complete base layout for full ownership.

#### Scenario: Fork creates overlay scaffold
- **WHEN** the user runs `codecorral view fork command-center`
- **THEN** the CLI creates `.codecorral/views/command-center.ts` with an empty `defineOverlay` export and comments listing available panel roles from the base layout

#### Scenario: Fork with --full copies base
- **WHEN** the user runs `codecorral view fork command-center --full`
- **THEN** the CLI creates `.codecorral/views/command-center.ts` with the complete base `defineLayout` content

#### Scenario: Fork for workflow machine
- **WHEN** the user runs `codecorral view fork unit-workflow`
- **THEN** the CLI creates `.codecorral/views/unit-workflow.ts` with empty overlays keyed by each state name that has a `meta.view`

#### Scenario: Fork target already exists
- **WHEN** the user runs `codecorral view fork command-center` and `.codecorral/views/command-center.ts` already exists
- **THEN** the CLI prints a warning and exits without overwriting

### Requirement: Workspace metadata in layout config
A layout config SHALL support optional `pinned` (boolean) and `position` (number) fields. When `pinned` is true, the view engine SHALL create the workspace with the cmux pinned option (C2 contract extension). The `position` field SHALL hint at sidebar ordering. These fields are optional and only meaningful for permanent fixtures like the command center.

#### Scenario: Pinned workspace
- **WHEN** a layout config has `pinned: true` and `position: 0`
- **THEN** the view engine creates the workspace with the pinned flag and position hint

#### Scenario: Workflow workspace (not pinned)
- **WHEN** a layout config omits `pinned` and `position`
- **THEN** the view engine creates a regular workspace without pinning

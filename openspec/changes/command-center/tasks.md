## 1. Core Layout Types

- [ ] 1.1 Create `src/cmux/layout-types.ts` with `PaneConfig`, `PanelConfig`, `LayoutConfig`, `OverlayConfig`, `LayoutContext`, `WorkflowViewContext`, `ResolvedLayout`, `Region` types
- [ ] 1.2 Add `ResolvedWorkspaceConfig` type that extends `WorkspaceConfig` with parsed `conductors` array (normalizing from single `conductor` or `conductors` field)
- [ ] 1.3 Export all types from `src/cmux/index.ts` barrel

## 2. Builder Functions

- [ ] 2.1 Implement `defineLayout(config: LayoutConfig): LayoutConfig` in `src/cmux/layout.ts`
- [ ] 2.2 Implement `defineOverlay(base: string, config: OverlayConfig): OverlayConfig & { base: string }` in `src/cmux/layout.ts`
- [ ] 2.3 Add tests for `defineLayout` with static panels, dynamic panel function, and type validation
- [ ] 2.4 Add tests for `defineOverlay` with all operation types (add, remove, override, panes.add, panes.remove)

## 3. Resolution Logic

- [ ] 3.1 Implement `resolveLayout(base: LayoutConfig, overlay: OverlayConfig | null, ctx: LayoutContext): ResolvedLayout` in `src/cmux/resolve.ts`
- [ ] 3.2 Handle dynamic panel evaluation: call `panels` function with `ctx` if function, use array as-is otherwise
- [ ] 3.3 Implement overlay application order: remove panels → remove panes → override panels → add panes → add panels
- [ ] 3.4 Implement validation: warn on orphaned panels, warn on removing non-existent roles
- [ ] 3.5 Add tests: no overlay (passthrough), overlay add/remove/override, pane operations, orphaned panel warning, dynamic panels with context

## 4. Overlay File Loader

- [ ] 4.1 Create `src/cmux/overlay-loader.ts` with `loadOverlay(layoutName: string)` function
- [ ] 4.2 Implement file discovery: `.codecorral/views/{name}.ts` (project-local), then `~/.codecorral/views/{name}.ts` (user-global), first match wins
- [ ] 4.3 Load via `import()` — Bun handles TypeScript natively
- [ ] 4.4 Handle single overlay export (command center) vs record export (workflow machine keyed by state name)
- [ ] 4.5 Add tests with fixture overlay files

## 5. State Machine View Integration

- [ ] 5.1 Create `src/cmux/view-bridge.ts` with `getViewForState(machine, state, overlays): ResolvedLayout | null`
- [ ] 5.2 Handle states with no `meta.view` (return null — signals workspace close)
- [ ] 5.3 Handle same layout reference across states (skip reconciliation)
- [ ] 5.4 Add tests: state with view, state without view, overlay targeting non-existent state logs warning

## 6. Workspace Config Extension

- [ ] 6.1 Add `board` (string, optional) and `conductors` (array, optional) fields to `WorkspaceConfig` type in `src/actors/types.ts`; accept `conductor` (singular) as shorthand
- [ ] 6.2 Update `loadConfigFile` in `src/config/loader.ts` to parse `board` and `conductors`/`conductor` fields, normalizing singular to array
- [ ] 6.3 Update `codecorral workspaces` command to display `board` and conductors when configured
- [ ] 6.4 Add tests for config parsing with board and conductors fields (multiple, single shorthand, absent)

## 7. Cmux Environment Detection

- [ ] 7.1 Create `src/cmux/env.ts` with `detectCmuxContext()` returning `{ workspaceId, surfaceId } | null` from env vars
- [ ] 7.2 Create `src/cmux/client.ts` with `resolveWindowId()` that calls `system.identify()` via cmux socket
- [ ] 7.3 Add tests for detection and window resolution with mocked env/socket

## 8. Command Center Layout

- [ ] 8.1 Create `src/cmux/layouts/command-center.ts` as built-in layout using `defineLayout` with pane grouping: conductors pane (main) + board pane (right), dynamic panels from workspace context
- [ ] 8.2 Add tests for layout resolution: full config (N conductors + board), no board, no conductors, with overlay

## 9. Command Center Activation

- [ ] 9.1 Create `src/cmux/activate.ts` with activation logic: detect context, resolve workspace, resolve layout (base + overlay), issue cmux primitives
- [ ] 9.2 Implement idempotency: resolve window ID, check daemon for existing `CommandCenterState`, return early if active
- [ ] 9.3 Implement workspace resolution: match CWD against configured workspace paths
- [ ] 9.4 Persist `CommandCenterState` after successful activation

## 10. CLI Commands

- [ ] 10.1 Create `src/cli/commands/activate.ts`: detect cmux env, bail if outside, send activation request to daemon
- [ ] 10.2 Create `src/cli/commands/view.ts` with `view fork <name> [--full]`: scaffold overlay or copy base
- [ ] 10.3 Implement overlay scaffold generation: extract panel roles from base, generate empty `defineOverlay`
- [ ] 10.4 Implement `--full` mode and workflow machine scaffold (record keyed by state names with `meta.view`)
- [ ] 10.5 Register `activate` and `view` commands in `src/cli/index.ts`
- [ ] 10.6 Implement outside-cmux error message and fork safety check (refuse overwrite)

## 11. Daemon Integration

- [ ] 11.1 Add `activate` message handler to daemon socket protocol
- [ ] 11.2 Store `CommandCenterState` per window in daemon state
- [ ] 11.3 Add stale workspace ID detection for recovery

## 12. Integration Testing

- [ ] 12.1 End-to-end: define layout, resolve with overlay, verify pane/panel structure
- [ ] 12.2 End-to-end: activate inside cmux (mocked env), verify cmux RPC call order
- [ ] 12.3 Idempotency: activate twice, verify second returns existing state
- [ ] 12.4 Recovery: simulate cmux restart, verify rebuild
- [ ] 12.5 End-to-end: `view fork` → edit overlay → resolve → verify customizations
- [ ] 12.6 End-to-end: mock XState machine with `meta.view`, verify `getViewForState` with and without overlays

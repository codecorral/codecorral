## 1. Core Types

- [ ] 1.1 Create `src/cmux/layout-types.ts` with `PaneConfig`, `PanelConfig`, `LayoutConfig`, `OverlayConfig`, `LayoutContext`, `WorkflowViewContext`, `ResolvedLayout`, `Region` types
- [ ] 1.2 Add `ResolvedWorkspaceConfig` type that extends `WorkspaceConfig` with parsed `conductors` array (normalizing from single `conductor` or `conductors` field)
- [ ] 1.3 Export all types from `src/cmux/index.ts` barrel

## 2. Builder Functions

- [ ] 2.1 Implement `defineLayout(config: LayoutConfig): LayoutConfig` in `src/cmux/layout.ts` — identity function that provides type narrowing
- [ ] 2.2 Implement `defineOverlay(base: string, config: OverlayConfig): OverlayConfig & { base: string }` in `src/cmux/layout.ts`
- [ ] 2.3 Add tests for `defineLayout` with static panels, dynamic panel function, and missing fields (type-level, compile check)
- [ ] 2.4 Add tests for `defineOverlay` with all operation types (add, remove, override, panes.add, panes.remove)

## 3. Resolution Logic

- [ ] 3.1 Implement `resolveLayout(base: LayoutConfig, overlay: OverlayConfig | null, ctx: LayoutContext): ResolvedLayout` in `src/cmux/resolve.ts`
- [ ] 3.2 Handle dynamic panel evaluation: call `panels` function with `ctx` if it's a function, use array as-is otherwise
- [ ] 3.3 Implement overlay application order: remove panels → remove panes → override panels → add panes → add panels
- [ ] 3.4 Implement validation: warn on orphaned panels (pane reference doesn't exist), warn on removing non-existent roles
- [ ] 3.5 Add tests: no overlay (passthrough), overlay add, overlay remove, overlay override, overlay pane operations, orphaned panel warning, dynamic panels with context

## 4. Overlay File Loader

- [ ] 4.1 Create `src/cmux/overlay-loader.ts` with `loadOverlay(layoutName: string): Promise<OverlayConfig | Record<string, OverlayConfig> | null>`
- [ ] 4.2 Implement file discovery: check `.codecorral/views/{name}.ts` (project-local), then `~/.codecorral/views/{name}.ts` (user-global), first match wins
- [ ] 4.3 Load via `import()` — Bun handles TypeScript natively, no build step
- [ ] 4.4 Handle single overlay export (command center style) vs record export (workflow machine style — keyed by state name)
- [ ] 4.5 Add tests with fixture overlay files: single overlay, record of overlays, missing file returns null, malformed file logs error

## 5. State Machine View Integration

- [ ] 5.1 Create `src/cmux/view-bridge.ts` with `getViewForState(machine, state, overlays): ResolvedLayout | null` that reads `state.meta.view`, finds matching overlay by state name, calls `resolveLayout`
- [ ] 5.2 Handle states with no `meta.view` (return null — signals workspace close)
- [ ] 5.3 Handle same layout reference across states (return equality signal so caller can skip reconciliation)
- [ ] 5.4 Add tests: state with view, state without view, state with overlay, overlay targeting non-existent state logs warning

## 6. CLI — view fork Command

- [ ] 6.1 Create `src/cli/commands/view.ts` with `view fork <layout-name> [--full]` subcommand
- [ ] 6.2 Implement overlay scaffold generation: read base layout, extract panel roles, generate empty `defineOverlay` with role comments
- [ ] 6.3 Implement `--full` mode: copy base layout as complete `defineLayout` export
- [ ] 6.4 Implement workflow machine scaffold: read machine definition, find states with `meta.view`, generate record-keyed overlay file
- [ ] 6.5 Implement safety check: refuse to overwrite existing file, print warning
- [ ] 6.6 Register `view` command in `src/cli/index.ts`
- [ ] 6.7 Add tests: fork creates overlay file, fork --full creates full layout, fork refuses overwrite, fork for workflow machine generates correct keys

## 7. Command Center Migration

- [ ] 7.1 Refactor command-center change to use `defineLayout` for its layout config (replacing any inline layout construction)
- [ ] 7.2 Add command-center as a named built-in layout in `src/cmux/layouts/command-center.ts`
- [ ] 7.3 Verify `codecorral view fork command-center` produces a correct overlay scaffold for the command center

## 8. Integration Testing

- [ ] 8.1 End-to-end test: define a layout, resolve with overlay, verify final pane/panel structure matches expectations
- [ ] 8.2 End-to-end test: mock XState machine with `meta.view` on states, verify `getViewForState` returns correct layouts with and without overlays
- [ ] 8.3 End-to-end test: `codecorral view fork` → edit overlay → resolve layout → verify customizations appear in resolved output

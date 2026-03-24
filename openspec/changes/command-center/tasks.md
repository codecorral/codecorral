## 1. Workspace Config Extension

- [ ] 1.1 Add `board` (string, optional) and `conductor` (`{ name?: string }`, optional) fields to `WorkspaceConfig` type in `src/actors/types.ts`
- [ ] 1.2 Update `loadConfigFile` in `src/config/loader.ts` to parse `board` and `conductor` fields from YAML
- [ ] 1.3 Update `codecorral workspaces` command to display `board` and `conductor.name` when configured
- [ ] 1.4 Add tests for config parsing with board and conductor fields (present, absent, partial)

## 2. Cmux Environment Detection

- [ ] 2.1 Create `src/cmux/env.ts` module that reads cmux environment variables (`CMUX_WINDOW_ID`, `CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`) and exports a `detectCmuxContext()` function returning `{ windowId, workspaceId, surfaceId } | null`
- [ ] 2.2 Add tests for `detectCmuxContext` with env vars set and unset

## 3. Command Center Layout

- [ ] 3.1 Create `src/cmux/layout.ts` with `CommandCenterLayout`, `PanelConfig`, and `CommandCenterState` type definitions (per design D2, D3)
- [ ] 3.2 Implement `buildCommandCenterLayout(workspace: WorkspaceConfig): CommandCenterLayout` that assembles the panel list based on which workspace config fields are present (board, conductor)
- [ ] 3.3 Add tests for layout building: full config (both panels), no board (terminal only), no conductor (shell fallback), minimal config (shell only)

## 4. Command Center Activation

- [ ] 4.1 Create `src/cmux/activate.ts` with the activation logic: detect cmux context, resolve workspace by matching CWD against configured paths, build layout, issue cmux primitives (createWorkspace, splitSurface, sendText, openBrowserSplit)
- [ ] 4.2 Implement idempotency check: query daemon for existing `CommandCenterState` by window ID, return early if already active
- [ ] 4.3 Implement workspace resolution: match `process.cwd()` against configured workspace paths to determine which workspace config to use
- [ ] 4.4 Persist `CommandCenterState` after successful activation (window ID, workspace ID, panel role → surface ID mapping)

## 5. CLI Command

- [ ] 5.1 Create `src/cli/commands/activate.ts` with Commander command definition: detect cmux env, bail with message if outside cmux, otherwise send activation request to daemon
- [ ] 5.2 Register `activate` command in `src/cli/index.ts`
- [ ] 5.3 Implement the outside-cmux error message with helpful guidance (per design D6)

## 6. Daemon Integration

- [ ] 6.1 Add `activate` message handler to the daemon socket protocol (receives window ID, returns activation result or existing status)
- [ ] 6.2 Store `CommandCenterState` per window in daemon's in-memory state alongside workflow instances
- [ ] 6.3 Add stale workspace ID detection: when cmux operations fail on a stored workspace ID, null out the state for recovery on next activate

## 7. Integration Testing

- [ ] 7.1 End-to-end test: activate command inside cmux (mocked env vars), verify cmux RPC calls are issued in correct order (createWorkspace → splitSurface → sendText / openBrowserSplit)
- [ ] 7.2 Idempotency test: activate twice, verify second call returns existing state without issuing cmux commands
- [ ] 7.3 Recovery test: simulate cmux restart (stored workspace ID returns error), verify activate rebuilds

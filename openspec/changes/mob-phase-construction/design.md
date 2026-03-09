## Context

Phase 3 (Construction) is the coding phase — Ralph-TUI processes beads created by bolt elaboration, each one a focused implementation task. This is the most mechanical phase: read specs, implement code, verify acceptance criteria, close bead. The primary design considerations are parallel execution, worktree isolation, and dependency enforcement.

The orchestration infrastructure (conductor, loop transitions, Ralph config) is defined in [mob-infrastructure](../mob-infrastructure/design.md). The construction.hbs prompt template is defined in [mob-agent-team-prompting](../mob-agent-team-prompting/design.md). This change defines the construction-specific execution flow.

## Goals / Non-Goals

**Goals:**
- Define how construction beads are processed by Ralph `--parallel`
- Define worktree isolation for parallel bead execution
- Define bead dependency enforcement so foundational code precedes dependent features
- Define Loop 3 Ralph-TUI invocation settings

**Non-Goals:**
- Conductor transition implementation (see [mob-infrastructure](../mob-infrastructure/design.md))
- Construction prompt template content (see [mob-agent-team-prompting](../mob-agent-team-prompting/design.md))
- Bead creation (see [mob-phase-bolt-elaboration](../mob-phase-bolt-elaboration/design.md))

## Decisions

### D5: One bead per loop (construction specifics)

Loop 3 runs MANY beads per unit. Each bead was created by Loop 2's beads artifact and represents one focused coding session. Ralph-TUI iterates through available beads, executing each as a separate `--print` Claude Code session.

### D9: Bead structure (construction beads)

Loop 3 beads (created by Loop 2's beads artifact):
```bash
# One epic per unit, M beads per epic
br create --type=epic --title="{intent-name} / {unit-name}" \
  --external-ref="openspec:openspec/changes/{intent}-{unit}/specs"
for task in spec-derived-tasks; do
  br create --type=task --parent=EPIC-ID \
    --title="{task-title}" \
    --description="{task-description with spec references}" \
    --priority={priority}
done
# Wire dependencies between construction tasks
br dep add TASK-B TASK-A
```

### Parallel execution configuration

Ralph-TUI runs Loop 3 with `--parallel 3` (configurable), which:
- Spawns up to 3 concurrent Claude Code `--print` sessions
- Each session runs in its own git worktree for isolation
- Worktrees are created and cleaned up by Ralph automatically
- Only beads reported as `ready` by `br ready` are dispatched (dependency enforcement)

### Worktree isolation

Each parallel construction session runs in a dedicated git worktree:
- Worktree branch: `wt/construction-{intent}-{unit}-{task-id}`
- Changes are committed within the worktree
- Merging worktree branches back to main is managed by Ralph or the developer
- Worktrees are cleaned up after bead completion

## Risks / Trade-offs

**[Worktree merge conflicts]** → Parallel construction sessions may produce conflicting changes. Mitigation: bead dependencies ensure foundational beads complete first. Independent beads by definition should not conflict.

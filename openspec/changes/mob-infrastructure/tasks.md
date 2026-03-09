## 5. Ralph-TUI Configuration (Base)

- [ ] 5.1 Update `.ralph-tui/config.toml` base config: verify tracker=beads-rust, agent=claude, autoCommit=true are set

## 6. Conductor Script

- [ ] 6.1 Write conductor script that reads intent-brief frontmatter and extracts signal field
- [ ] 6.2 Implement signal-to-action mapping: trivial → skip, simple → ralph solo, moderate → AgentDeck 3-agent, complex/architectural → AgentDeck 5-agent
- [ ] 6.3 Implement inception bead creation: `br create --type=epic` + one child bead with intent brief
- [ ] 6.4 Implement Loop 1→2 transition: read units.md from completed inception change, create bolt epic with one bead per unit, wire dependencies from bolt-plan
- [ ] 6.5 Implement Loop 2→3 transition: verify bolt beads are closed, confirm construction beads exist, invoke Ralph for Loop 3
- [ ] 6.6 Implement signal suggestion heuristics (greenfield → complex, single-spec → simple, multi-spec → moderate)
- [ ] 6.7 Implement AgentDeck session activation/deactivation for inception mob elaboration

## 9. Session Management

- [ ] 9.1 Implement pool model setup: create pre-configured AgentDeck sessions in Ideation group
- [ ] 9.2 Implement pool dispatch: select idle session, dispatch via `agent-deck session send`, verify activation
- [ ] 9.3 Implement phase group assignment: sessions placed in correct group (Ideation/Elaboration/Review/Construction) at creation
- [ ] 9.4 Implement TuiCR lifecycle: dynamic review session creation at phase boundaries, approval/rejection handling
- [ ] 9.5 Implement session teardown: clean up sessions when epic beads are all closed

## 8. End-to-End Validation (Infrastructure)

- [ ] 8.3 Test Loop 1→2 transition: conductor reads units.md → creates bolt epic with per-unit beads
- [ ] 8.8 Test full lifecycle: inception → bolt-elaboration → construction for a real feature

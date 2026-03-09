## 5. Ralph-TUI Configuration (Construction)

- [ ] 5.3 Document Loop 3 invocation: `ralph-tui run --epic construction-{intent}-{unit} --prompt .ralph-tui/templates/construction.hbs --iterations 20 --parallel 3`
- [ ] 5.4 Configure parallel settings for Loop 3: `[parallel] mode = "auto"`, `maxWorkers = 3`, worktree isolation
- [ ] 5.6 Test Loop 3 end-to-end: construction beads → Ralph processes in parallel → code implemented → beads closed

## 8. End-to-End Validation (Construction)

- [ ] 8.6 Test Loop 2→3 transition: bolt beads close → construction beads available → Ralph runs Loop 3
- [ ] 8.7 Test Loop 3: Ralph runs construction beads in parallel → code implemented → beads closed
- [ ] 8.10 Test opsx:verify against bolt change after construction

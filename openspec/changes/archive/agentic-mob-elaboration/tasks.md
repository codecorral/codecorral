## 1. Agent Persona Files

- [ ] 1.1 Create `.claude/agents/` directory
- [ ] 1.2 Write `mob-analyst.md` — Product Analyst persona: user outcomes focus, requirements-draft output format, cross-review messaging instructions
- [ ] 1.3 Write `mob-architect.md` — System Architect persona: components/interfaces focus, system-context output format with mermaid diagrams, cross-review messaging
- [ ] 1.4 Write `mob-critic.md` — Devil's Advocate persona: adversarial focus, challenge format (target/issue/evidence/severity), mandatory SendMessage instructions
- [ ] 1.5 Write `mob-domain-modeler.md` — Domain Modeler persona: entities/aggregates/bounded contexts, ubiquitous language glossary, domain boundary validation
- [ ] 1.6 Write `mob-qa-strategist.md` — QA Strategist persona: test pyramid planning, edge case catalog, BDD scenario templates, testability assessment
- [ ] 1.7 Add lean-mob variant notes in analyst (absorb domain concerns) and critic (absorb QA concerns) personas

## 2. Inception Schema (Loop 1)

- [ ] 2.1 Create `openspec/schemas/inception/` directory with schema manifest
- [ ] 2.2 Define 5 artifact types: intent-brief, requirements, system-context, units, bolt-plan
- [ ] 2.3 Define dependency graph: intent-brief → {requirements, system-context} → units → bolt-plan
- [ ] 2.4 Write intent-brief template with signal frontmatter (trivial/simple/moderate/complex/architectural)
- [ ] 2.5 Write requirements artifact template (FR-N format, NFRs, user stories, BDD acceptance criteria)
- [ ] 2.6 Write system-context artifact template (boundaries, interfaces, mermaid diagram, constraints)
- [ ] 2.7 Write units artifact template (name, scope, boundaries, dependencies, bolt-type per unit)
- [ ] 2.8 Write bolt-plan artifact template (execution order, parallel groups, unit-to-change mapping)
- [ ] 2.9 Write instruction files for each artifact type
- [ ] 2.10 Add optional human-review sentinel between {requirements, system-context} and units
- [ ] 2.11 Set bolt-plan as the apply-requires target
- [ ] 2.12 Test with `openspec new change --schema inception` and verify status output

## 3. Bolt Schema (Loop 2)

- [ ] 3.1 Create `openspec/schemas/bolt/` directory with schema manifest
- [ ] 3.2 Define 4 artifact types: proposal, design, specs, beads
- [ ] 3.3 Define dependency graph: proposal → {design, specs} → beads
- [ ] 3.4 Make design artifact optional for simple bolt types
- [ ] 3.5 Write proposal template pre-populated with unit context (name, scope, boundaries from inception units.md)
- [ ] 3.6 Write design template with DDD variant (domain model, ADRs, technical architecture) and simple variant
- [ ] 3.7 Write specs template (requirements with Given/When/Then scenarios)
- [ ] 3.8 Write beads artifact instructions: create br epic for unit, child beads per implementable task, bead dependency ordering, spec traceability metadata via `--external-ref`
- [ ] 3.9 Set beads as the apply-requires target
- [ ] 3.10 Test with `openspec new change --schema bolt` and verify status output
- [ ] 3.11 Test beads creation via br CLI produces valid beads with correct metadata

## 4. Ralph-TUI Prompt Templates

- [ ] 4.1 Create `.ralph-tui/templates/` directory
- [ ] 4.2 Write `bolt-elaboration.hbs` — Loop 2 template: create bolt change, generate proposal/design/specs, create beads via br, close bead, document progress. Include conditional for DDD vs simple bolt type via `{{labels}}`
- [ ] 4.3 Write `construction.hbs` — Loop 3 template: review specs via epic's external-ref, implement bead task, verify acceptance criteria, close bead via br, emit `<promise>COMPLETE</promise>`
- [ ] 4.4 Test bolt-elaboration template rendering with sample bead context (verify Handlebars variables resolve correctly)
- [ ] 4.5 Test construction template rendering with sample bead context

## 5. Ralph-TUI Configuration

- [ ] 5.1 Update `.ralph-tui/config.toml` base config: verify tracker=beads-rust, agent=claude, autoCommit=true are set
- [ ] 5.2 Document Loop 2 invocation: `ralph-tui run --epic bolt-{intent} --prompt .ralph-tui/templates/bolt-elaboration.hbs --iterations 10`
- [ ] 5.3 Document Loop 3 invocation: `ralph-tui run --epic construction-{intent}-{unit} --prompt .ralph-tui/templates/construction.hbs --iterations 20 --parallel 3`
- [ ] 5.4 Configure parallel settings for Loop 3: `[parallel] mode = "auto"`, `maxWorkers = 3`, worktree isolation
- [ ] 5.5 Test Loop 2 end-to-end: bolt-elaboration bead → Ralph processes → bolt change created → beads created
- [ ] 5.6 Test Loop 3 end-to-end: construction beads → Ralph processes in parallel → code implemented → beads closed

## 6. Conductor Script

- [ ] 6.1 Write conductor script that reads intent-brief frontmatter and extracts signal field
- [ ] 6.2 Implement signal-to-action mapping: trivial → skip, simple → ralph solo, moderate → AgentDeck 3-agent, complex/architectural → AgentDeck 5-agent
- [ ] 6.3 Implement inception bead creation: `br create --type=epic` + one child bead with intent brief
- [ ] 6.4 Implement Loop 1→2 transition: read units.md from completed inception change, create bolt epic with one bead per unit, wire dependencies from bolt-plan
- [ ] 6.5 Implement Loop 2→3 transition: verify bolt beads are closed, confirm construction beads exist, invoke Ralph for Loop 3
- [ ] 6.6 Implement signal suggestion heuristics (greenfield → complex, single-spec → simple, multi-spec → moderate)
- [ ] 6.7 Implement AgentDeck session activation/deactivation for inception mob elaboration

## 7. Team Configuration

- [ ] 7.1 Create team config definitions (lean-mob: 3 agents, full-mob: 5 agents)
- [ ] 7.2 Write team lead spawn prompt for lean mob: references mob-analyst, mob-architect, mob-critic agent files, task structure with 3 phases
- [ ] 7.3 Write team lead spawn prompt for full mob: references all 5 agent files, parallel tracks (requirements + system-context), cross-review phase
- [ ] 7.4 Create AgentDeck session pool entries: one for lean-mob, one for full-mob

## 8. End-to-End Validation

- [ ] 8.1 Test inception: signal `moderate` → conductor creates inception bead → AgentDeck 3-agent mob → inception artifacts produced → bead closed
- [ ] 8.2 Test inception: signal `complex` → 5-agent mob → parallel tracks → all inception artifacts
- [ ] 8.3 Test Loop 1→2 transition: conductor reads units.md → creates bolt epic with per-unit beads
- [ ] 8.4 Test Loop 2: Ralph runs bolt-elaboration → bolt change created per unit → beads created via br
- [ ] 8.5 Test DDD vs simple: DDD unit gets design with domain model, simple unit skips design
- [ ] 8.6 Test Loop 2→3 transition: bolt beads close → construction beads available → Ralph runs Loop 3
- [ ] 8.7 Test Loop 3: Ralph runs construction beads in parallel → code implemented → beads closed
- [ ] 8.8 Test full lifecycle: inception → bolt-elaboration → construction for a real feature
- [ ] 8.9 Test trivial/simple signals: inception skipped or reduced
- [ ] 8.10 Test opsx:verify against bolt change after construction

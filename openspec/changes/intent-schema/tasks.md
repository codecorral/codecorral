## 1. Schema Initialization

- [x] 1.1 Run `openspec schema init intent --description "AI-DLC inception workflow - intent to units" --artifacts intent-brief,requirements,system-context,units,bolt-plan` to scaffold the schema directory
- [x] 1.2 Edit `openspec/schemas/intent/schema.yaml` to set the dependency graph: intent-brief requires nothing, requirements and system-context each require intent-brief, units requires both requirements and system-context, bolt-plan requires units
- [x] 1.3 Set `apply.requires: [bolt-plan]` in schema.yaml so bolt-plan gates the apply phase

## 2. Templates

- [x] 2.1 Create `templates/intent-brief.md` with sections: Problem Statement, Desired Outcome, Scope, Stakeholders, Constraints
- [x] 2.2 Create `templates/requirements.md` with sections: User Stories, Use Cases, Non-Functional Requirements, Boundaries
- [x] 2.3 Create `templates/system-context.md` with sections: System Landscape, Context Boundary, Adjacent Systems, Impact Analysis, Technical Landscape
- [x] 2.4 Create `templates/units.md` with a repeatable unit entry structure: name, description, deliverable, dependencies
- [x] 2.5 Create `templates/bolt-plan.md` with sections: Execution Plan (wave-based table with unit, priority, dependencies), Bead Creation notes

## 3. Artifact Instructions

- [x] 3.1 Write the intent-brief instruction emphasizing normalization: expand sparse input, distill verbose input, never invent requirements, produce consistent five-section output regardless of input detail level
- [x] 3.2 Write the requirements instruction: derive user stories and use cases from the intent-brief, identify NFRs and scope boundaries, keep it lightweight (no formal SHALL/scenario format)
- [x] 3.3 Write the system-context instruction: position the intent in the system landscape using C4 framing, identify adjacent systems and integration points, analyze how the intent changes the current architecture
- [x] 3.4 Write the units instruction: decompose the intent into independently deliverable units based on requirements and system-context, create a `units/<unit-name>/unit-brief.md` file for each unit with enough context to seed a Loop 2 spec-driven proposal
- [x] 3.5 Write the bolt-plan instruction: organize units into dependency waves, assign priorities, produce information sufficient for creating one elaboration bead per unit

## 4. Validation

- [x] 4.1 Run `openspec schema validate intent` to verify schema structure
- [x] 4.2 Run `openspec schemas` to verify the intent schema appears in the listing
- [x] 4.3 Test `openspec new change test-intent --schema intent` and verify it scaffolds the correct five-artifact structure
- [x] 4.4 Run `openspec status --change test-intent` and verify the dependency graph: intent-brief is ready, all others are blocked with correct missingDeps
- [x] 4.5 Clean up test change after validation

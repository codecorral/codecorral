## Context

CodeCorral's AI-DLC lifecycle has two elaboration phases: inception (intent -> units) and per-unit elaboration (proposal -> specs -> design -> tasks). OpenSpec provides the `spec-driven` schema for the second phase. The first phase needs its own schema — the `intent` schema — to standardize how intents are decomposed into units.

OpenSpec supports custom schemas via `openspec schema init <name>`, which creates a `schema.yaml` and `templates/` directory at `openspec/schemas/<name>/`. The schema format is defined by the built-in `spec-driven` schema: a YAML file with `name`, `version`, `description`, and an `artifacts` array where each artifact has `id`, `generates`, `description`, `template`, `instruction`, and `requires`.

The human initiates inception via `opsx:new --schema intent` or `opsx:ff --schema intent`, providing the raw intent as part of the prompt. The schema's artifacts are then generated in DAG order.

## Goals / Non-Goals

**Goals:**
- Define a five-artifact schema that takes a raw intent to identified, bounded units
- Support parallel generation of `requirements` and `system-context` after `intent-brief`
- Produce per-unit brief files that can seed Loop 2 `spec-driven` changes
- Keep inception-level artifacts intentionally lighter than spec-driven artifacts

**Non-Goals:**
- Intent signal classification and routing (future feature)
- Bead creation commands in artifact instructions (that's CC-3)
- Mob elaboration integration (that's openmob's concern)
- The unit schema (CC-2) — that's a separate change

## Decisions

### D1: Schema follows the standard OpenSpec schema.yaml format

The intent schema uses the same `schema.yaml` structure as `spec-driven`. No extensions to the schema format are needed.

```yaml
name: intent
version: 1
description: "AI-DLC inception workflow — intent to units"
artifacts:
  - id: intent-brief
    generates: intent-brief.md
    requires: []
  - id: requirements
    generates: requirements.md
    requires: [intent-brief]
  - id: system-context
    generates: system-context.md
    requires: [intent-brief]
  - id: units
    generates: units.md
    requires: [requirements, system-context]
  - id: bolt-plan
    generates: bolt-plan.md
    requires: [units]
```

**Alternative considered:** Extending the schema format with custom fields (e.g., `mob-config`, `bead-labels`). Rejected — keep the schema standard. Bead integration is a separate concern (CC-3).

### D2: Units artifact is a single file; unit briefs are a side-effect

The `units` artifact generates `units.md` — a single file listing all identified units with descriptions, deliverables, and dependencies. The generation instruction directs the AI to also create `units/<unit-name>/unit-brief.md` files as a side-effect.

This keeps the schema simple (`generates: units.md`) while still producing the per-unit briefs needed to seed Loop 2 changes.

**Alternative considered:** `generates: "units/**/*.md"` glob pattern like specs uses. Rejected — the units artifact's primary output is the overview/index. The briefs are secondary outputs that support the next loop, not the primary artifact for dependency tracking.

### D3: Bolt-plan is the apply gate

The schema's `apply` section requires `bolt-plan`:

```yaml
apply:
  requires: [bolt-plan]
```

This means "apply" for the intent schema means "create Loop 2 beads from the bolt-plan." The bolt-plan is only created when units are stable, so it naturally gates premature dispatch.

### D4: Intent-brief instruction emphasizes normalization

The intent-brief instruction explicitly tells the AI to normalize varying input detail levels into a consistent format. Whether the human supplies "add dark mode" or a 10-page design doc, the output should be the same structured brief. The instruction should state: expand sparse input, distill verbose input, never invent requirements.

### D5: Requirements are intentionally lightweight

The requirements artifact uses user stories, use cases, and boundaries — not formal SHALL/scenario specs. This keeps inception fast and exploratory. Formal specs come in Loop 2 per-unit.

### D6: System-context uses C4 framing

The system-context artifact positions the intent within the system landscape using C4 concepts: system context boundary, adjacent systems, and impact analysis. This gives the units artifact enough architectural grounding to identify meaningful decomposition boundaries.

## Risks / Trade-offs

**[Units as single file may not scale]** For intents with many units (10+), a single `units.md` could get long. Mitigation: the file is an index with brief entries; detail lives in unit briefs. Can revisit if this becomes a problem.

**[Side-effect file creation is unconventional]** The units artifact instruction asks the AI to create files beyond what `generates` declares. Mitigation: OpenSpec doesn't enforce that `generates` is exhaustive — it's used for status tracking. The instruction is free to direct additional file creation.

**[Bolt-plan may be premature for some intents]** Simple intents with one unit don't need wave planning. Mitigation: the bolt-plan can be minimal ("Wave 1: U1, no dependencies"). The artifact is still useful as the dispatch trigger.

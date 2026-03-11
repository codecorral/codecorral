## Why

The AI-DLC lifecycle begins with an Intent that must be systematically broken down into implementable units before construction can start. Currently, OpenSpec only provides the `spec-driven` schema which handles per-unit elaboration (proposal, specs, design, tasks). There is no schema for the inception phase — the step where a raw intent is expanded, bounded, contextualized, and decomposed into units. Without it, inception is ad-hoc and inconsistent across intents.

## What Changes

- Create a custom OpenSpec schema `intent` at `openspec/schemas/intent/` with five artifact types
- Define the artifact dependency DAG: `intent-brief` -> `requirements` | `system-context` -> `units` -> `bolt-plan`
- Provide templates for each artifact type that normalize intents of varying detail levels
- Provide instructions for each artifact that guide AI-assisted first-draft generation
- The `units` artifact produces per-unit brief files that seed Loop 2 `spec-driven` changes
- The `bolt-plan` artifact bridges inception to construction by defining unit ordering and bead creation

## Capabilities

### New Capabilities
- `intent-schema`: Custom OpenSpec schema defining the five-artifact inception workflow (intent-brief, requirements, system-context, units, bolt-plan) with dependency graph, templates, and generation instructions

### Modified Capabilities

## Impact

- `openspec/schemas/intent/` — new directory with `schema.yaml` and `templates/` folder
- Depends on OpenSpec `schema init` and custom schema support (experimental feature)
- Downstream: each unit produced by this schema becomes a separate `spec-driven` change in Loop 2
- No code changes — this is purely schema/template/instruction authoring

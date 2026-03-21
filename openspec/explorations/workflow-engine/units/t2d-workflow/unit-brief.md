## Unit: t2d-workflow

**Description:** The `dev.codecorral.t2d` OpenSpec schema and paired XState workflow definition, ported from t2d-kit. Converts t2d-kit's recipe-based pipeline (YAML recipe → transform agent → diagram generation) into OpenSpec artifacts and a CodeCorral workflow. Serves as both a useful built-in capability and the reference implementation of a non-software-development workflow running on CodeCorral.

**Deliverable:** `dev.codecorral.t2d` OpenSpec schema (artifact definitions, templates, instructions). `t2d-v1.0` XState workflow definition. The schema models t2d-kit's pipeline stages as OpenSpec artifacts: recipe normalization, diagram specification, multi-framework generation (D2, Mermaid, PlantUML), and documentation output. View configs for t2d workflow phases. This unit also serves as the primary reference for the schema-to-workflow authoring skill (Unit 8).

**Dependencies:** unit-workflow

## Relevant Requirements

- T2D (`dev.codecorral.t2d`) — Text-to-diagram workflow. Converts the recipe-based pipeline from t2d-kit into an OpenSpec schema and CodeCorral workflow.
- T2D workflow inherits t2d-kit's recipe model. The port converts these into OpenSpec artifacts and a CodeCorral workflow, not a rewrite from scratch.
- Serves as a reference implementation of a non-software-development workflow.

## System Context

**Source: [t2d-kit](https://github.com/afterthought/t2d-kit)** — a Python tool (v1.15.0) that transforms requirements/recipes into diagrams and documentation using AI agents. Key components to port:

- **Recipe model** (Pydantic): YAML recipes defining diagram type, framework, content, and styling
- **Transform agent**: Normalizes natural-language input into structured diagram specifications
- **Generator agents**: Produce diagrams in D2, Mermaid, and PlantUML from specifications
- **Documentation output**: Generates accompanying documentation for diagrams
- **MCP server** (`t2d-mcp`): Exposes t2d-kit capabilities as MCP tools
- **CLI** (`t2d`): Command-line interface for recipe processing

**Port strategy:** Convert t2d-kit's pipeline stages into OpenSpec artifacts. The agent session uses t2d-kit's MCP server (or equivalent tools) to do the actual diagram generation — the workflow orchestrates the stages, not reimplements them.

**Proposed schema artifacts:**
1. `recipe` (requires: none) — Normalize input (natural language or YAML) into a structured recipe
2. `diagram-spec` (requires: recipe) — Transform recipe into framework-specific diagram specifications
3. `diagrams` (requires: diagram-spec) — Generate diagrams in configured frameworks (D2, Mermaid, PlantUML)
4. `documentation` (requires: diagrams) — Generate accompanying documentation

**State machine structure:**
```
IDLE
  → workflow.pull → PULLED
    → (invoke: createSession with t2d MCP server) → RECIPE_LOADED
      → artifact.ready("recipe") → CHECKING → REVIEWING
        → review.approved → TRANSFORMING
      → artifact.ready("diagram-spec") → CHECKING → REVIEWING
        → review.approved → GENERATING
      → artifact.ready("diagrams") → CHECKING → REVIEWING
        → review.approved → DOCUMENTING
      → artifact.ready("documentation") → CHECKING
        → COMPLETING → CLEANUP → COMPLETE
```

**View configs for t2d phases:**
- Recipe: agent terminal (main), recipe YAML preview (right)
- Transform: agent terminal (main), diagram spec preview (right)
- Generation: agent terminal (main), browser pane with rendered diagram preview (right)
- Documentation: agent terminal (main), documentation preview (right)

## Scope Boundaries

**In scope:**
- `dev.codecorral.t2d` OpenSpec schema (artifact definitions, templates, instructions)
- `t2d-v1.0` XState workflow definition
- Mapping t2d-kit's pipeline stages to OpenSpec artifacts
- Session prompts referencing t2d-kit capabilities and diagram generation instructions
- View configs for t2d workflow phases (including browser pane for diagram preview)
- Review gates between artifacts (lighter than unit workflow — diagram review is visual)
- Documentation as a reference implementation for the authoring skill

**Out of scope:**
- Rewriting t2d-kit's core functionality — the agent uses t2d-kit's tools, the workflow orchestrates
- t2d-kit MCP server development — that's t2d-kit's repository
- Diagram rendering infrastructure (D2/Mermaid/PlantUML CLI tools) — assumed available in the agent's environment
- Integration with the intent or unit workflows — t2d is independent

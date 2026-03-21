# AI-DLC Glossary

Source: "AI-Driven Development Lifecycle (AI-DLC) Method Definition" by Raja SP, Amazon Web Services.

## Paradigm Distinction

| Term | Meaning |
|------|---------|
| **AI-Assisted** | AI augments fine-grained developer tasks (code gen, bug detection). Developer does the intellectual heavy-lifting. |
| **AI-Driven** | AI initiates and orchestrates the development process; humans serve as approvers/validators at decision junctures. This is the paradigm AI-DLC adopts. |

## Artifacts

| Term | Scrum Analogue | Definition |
|------|----------------|------------|
| **Intent** | — | A high-level statement of purpose (business goal, feature, or technical outcome). Starting point for AI-driven decomposition. |
| **Unit** | Epic / Subdomain | A cohesive, self-contained work element derived from an Intent. Delivers measurable value. Loosely coupled, enabling autonomous development and independent deployment. Analogous to DDD Subdomains or Scrum Epics. |
| **Bolt** | Sprint | The smallest iteration cycle in AI-DLC. Emphasizes rapid, intense cycles (hours or days, not weeks). A Unit executes through one or more Bolts, which may run in parallel or sequentially. |
| **User Story** | User Story | Retained from Agile — acts as a well-defined contract aligning human and AI understanding. |
| **PRFAQ** | — | Press Release / FAQ document summarizing business intent, functionality, and expected benefits for a Unit. |
| **Domain Design** | — | Models core business logic of a Unit independently of infrastructure. Uses DDD tactical elements: aggregates, value objects, entities, domain events, repositories, factories. |
| **Logical Design** | — | Extends Domain Design to meet NFRs using architectural patterns (CQRS, Circuit Breakers, etc.). Produces Architecture Decision Records (ADRs). |
| **Deployment Unit** | — | Operational artifact: packaged executable code (containers, serverless functions), configurations (Helm Charts), and infrastructure (Terraform/CFN stacks), rigorously tested. |
| **Risk Register** | — | Ensures AI-generated plans and code comply with organizational risk frameworks. |
| **Level 1 Plan** | — | AI-generated workflow plan for implementing an Intent. Humans verify and moderate. Recursively decomposed into Level 2 (subtasks) and deeper. |

## Phases

| Phase | Purpose |
|-------|---------|
| **Inception** | Capture Intents, elaborate into User Stories/NFRs/Risks, decompose into Units, plan Bolts. |
| **Construction** | Iterative execution: Domain Design → Logical Design → Code Generation → Testing. Transforms Units into tested Deployment Units. |
| **Operations** | Deployment, observability, maintenance. AI analyzes telemetry, predicts SLA violations, integrates with runbooks. |

## Rituals

| Ritual | Phase | Description |
|--------|-------|-------------|
| **Mob Elaboration** | Inception | Collaborative requirements elaboration in a single room with shared screen. AI proposes breakdown; the "mob" (PO, Devs, QA, stakeholders) reviews and refines. Condenses weeks of work into hours. |
| **Mob Construction** | Construction | Collocated teams exchange integration specs (from domain model stage), make decisions, deliver Bolts. |
| **Mob Testing** | Construction | AI executes all tests (functional, security, performance), analyzes results, proposes fixes. Developers validate and approve. |

## Roles

| Role | Responsibility |
|------|---------------|
| **Product Owner** | Sets Intents, validates Units and PRFAQs, approves trade-offs, ensures business alignment. |
| **Developer** | Validates AI outputs at each step, makes critical decisions, maintains oversight. Transcends traditional specialization silos. |
| **AI (Domain-Specific Agent)** | Drives planning, task decomposition, design, code generation, testing, and operational analysis. Initiates conversations with humans (reversed from traditional). |

## Key Principles (numbered per spec)

1. **Reimagine, don't retrofit** — Build new method from first principles, not bolt AI onto Scrum/SDLC.
2. **Reverse the conversation direction** — AI initiates and directs; humans approve at critical junctures. (Google Maps analogy: human sets destination, AI provides directions.)
3. **Integrate design techniques into the core** — DDD/BDD/TDD are integral, not optional add-ons. The spec describes the DDD flavor.
4. **Align with AI capability** — Realistic about current AI limitations; developers retain ultimate responsibility.
5. **Cater to complex systems** — Targets systems demanding architectural complexity, trade-off management, scalability. Simple systems are out of scope.
6. **Retain what enhances human symbiosis** — Keep artifacts critical for human validation (user stories, risk registers).
7. **Facilitate transition through familiarity** — Preserve relationships between familiar terms while modernizing (Sprint → Bolt).
8. **Streamline responsibilities** — AI enables developers to transcend specialization silos; minimize roles to first principles.
9. **Minimize stages, maximize flow** — Reduce handoffs; human validation acts as a "loss function" catching errors early.
10. **No hard-wired workflows** — AI recommends the plan based on pathway intention (green-field, brown-field, refactoring, defect fix); humans moderate.

## Workflow Steps (from diagram)

Each step builds semantically richer context for the next:

1. Build Context from Existing Codes (brown-field) or start fresh (green-field)
2. Elaborate Intent with User Stories
3. Plan the Units of Work
4. Model the Domain, Code & Test
5. Solve for Non-Functional Requirements
6. Resolve Deployment Architecture, Code & Test
7. Generate IaC & Test
8. Deploy in Production
9. Monitor, Manage Incidents

## Brown-Field Specifics

For existing systems, Construction adds preliminary steps:
- AI **elevates existing code** into higher-level modelling representations (static models: components/responsibilities/relationships; dynamic models: component interactions for key use cases).
- Developers + PMs review and correct the reverse-engineered models.
- Then proceeds as green-field from that point.

## Context Memory

All artifacts (intents, user stories, domain models, test plans) are persisted and serve as **context memory** that AI references across the lifecycle. Artifacts are linked for backward and forward traceability.

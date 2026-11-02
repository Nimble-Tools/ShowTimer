---
name: feature-specification
description: Generates a structured feature specification markdown file from a GitHub issue. Use when creating a spec for a new feature, epic, or backlog item that needs implementation planning.
---

# Feature Specification

Create a feature specification file at `.claude/specs/<issue-number>-<short-title>.md` using the structure below.

## Spec Format

### Header

```markdown
# <Feature Title>

**GitHub Issue**: #<number>
**Status**: Draft

## Overview

<What is being built and why. 2-4 sentences.>

## Acceptance Criteria

- [ ] <Testable condition 1>
- [ ] <Testable condition 2>

## Out of Scope

- <Explicitly list what is NOT included>

## Open Questions

- [ ] <Decision needed before implementation can begin>
```

### Implementation Phases

After the header sections, define sequential implementation phases. Each phase must be completable and testable before the next begins. Use this structure for each phase:

```markdown
## Phase 1: <Name> — <dotnet-agent | react-agent | test-agent>

**Goal**: <One sentence describing what this phase delivers>

### Tasks

- [ ] <Specific task 1 — e.g., "Create `Registration` entity with Id, EventId, AttendeeId, CheckedInAt">
- [ ] <Specific task 2 — e.g., "Add EF Core migration for Registrations table">
- [ ] <Specific task 3>

### Details

<Any data models, API endpoint signatures, component names, or other specifics needed to complete this phase without ambiguity. Include example request/response JSON for API endpoints.>

### Done When

- [ ] <Verifiable exit condition — e.g., "`dotnet build` passes with no warnings">
- [ ] <Verifiable exit condition — e.g., "GET /api/registrations returns 200 with correct shape">
```

## Phase Ordering Guidelines

Structure phases in this order where applicable:

1. **Data layer** (dotnet-agent): entities, EF Core migrations, repositories
2. **API layer** (dotnet-agent): endpoints, validation, business logic
3. **UI layer** (react-agent): components, forms, API integration
4. **Tests** (test-agent): unit tests for .NET and React, Playwright e2e for the happy path

Each phase must name which agent executes it.

## Guidelines

- Always begin by asking clarifying questions if any requirements or details are ambiguous. Do not make assumptions.
- Tasks must be specific enough to implement without clarifying questions
- Each task should be a single, independently completable unit of work
- "Done When" conditions must be objectively verifiable — no subjective criteria
- Flag security or performance considerations inline within the relevant phase
- Include example JSON for every API endpoint in the phase Details section

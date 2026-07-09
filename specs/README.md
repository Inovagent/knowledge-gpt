# Specs

This folder holds durable product and implementation specs for Knowledge GPT.
Specs follow the local `to-spec` shape so an agent can turn one into implementation
work without another discovery pass.

Use specs for work that changes product behavior, public API contracts, extension
capture behavior, storage behavior, setup requirements, or documentation policy.
Small refactors can use `Docs impact: none - <reason>` instead.

## Naming

- Use `NNNN-short-title.md`.
- Keep numbers stable after merge.
- Prefer one spec per user-visible capability or system contract.

## Writing Rules

- Use project vocabulary from `docs/CONTEXT.md`.
- Do not interview the user from inside the spec. Synthesize the known decision
  and make assumptions explicit.
- Implementation decisions should describe modules, interfaces, contracts, and
  behavior without depending on exact file paths or code snippets.
- Testing decisions should prefer the highest stable seam. In this repo, that is
  usually route-level backend behavior for API/storage flows, extension utility
  behavior for extraction helpers, and focused DOM tests for browser capture
  mounting/extraction.
- Include out-of-scope items so agents do not silently expand the work.
- If a project issue tracker is configured later, publish the spec there with the
  `ready-for-agent` label and link back to the in-repo spec.

## Template

```markdown
# NNNN - Spec Title

## Problem Statement

The problem from the user's perspective.

## Solution

The solution from the user's perspective.

## User Stories

1. As an <actor>, I want a <feature>, so that <benefit>.

## Implementation Decisions

- Decision about the modules, interfaces, contracts, architecture, schema, API,
  or interaction model.

## Testing Decisions

- State the highest testing seam and what external behavior proves the feature.

## Out of Scope

- Explicitly excluded behavior.

## Further Notes

- Assumptions, follow-ups, or issue-tracker links.
```

---
name: simple-mvp-guardrail
description: Keep MVP implementation plans and code changes intentionally small. Use when designing or implementing requirements to prevent overengineering, unnecessary frameworks, broad rewrites, async workflows, or premature persistence.
---

# Simple MVP Guardrail

Use this skill to keep work aligned with the smallest useful version of the requirement.

## Default stance

Prefer:

- direct, readable code over abstractions
- records and small classes over generic frameworks
- synchronous flows unless async is explicitly required
- built-in JDK or existing dependencies before adding libraries
- focused edits over rewrites
- explicit errors over hidden magic

Avoid by default:

- new frameworks or dependencies
- plugin architectures
- background jobs or queues
- persistence or caching
- generic configuration systems
- premature interfaces with one implementation
- large documentation files

## Decision check

Before adding structure, ask:

1. Is this required by the current requirement?
2. Is there already a simpler existing pattern in the repo?
3. Will this make testing easier, or just make the design look cleaner?
4. Can this be deferred without blocking the next MVP step?

If the answer favors deferral, defer it.

## Output expectation

When proposing or finishing work, call out any deliberate non-goals, for example:

- no persistence yet
- no async processing yet
- no browser rendering yet
- no new dependency added

For this project, follow `AGENTS.md`: keep implementations simple and add quality unit tests for code changes.

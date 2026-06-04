---
name: test-first-or-test-backed
description: Ensure implementation changes are protected by useful tests. Use whenever adding or changing application code, bug fixes, parsing logic, validation logic, controllers, services, or security-sensitive behavior.
---

# Test-first or Test-backed

Any code change should be test-backed unless the user explicitly asks otherwise.

## Workflow

1. Identify the behavior being changed in one sentence.
2. Find the nearest existing test style and framework before adding new patterns.
3. Prefer a failing test first when practical.
4. Implement the smallest code change that passes the test.
5. Run the focused test command, then broader tests if appropriate.

## Test quality bar

Good tests should cover:

- the normal successful path
- at least one meaningful edge case or failure path
- stable behavior, not implementation details

Avoid:

- tests that only assert Spring context loads
- over-mocked tests that duplicate the implementation
- snapshots or brittle string checks unless output formatting is the behavior
- adding new test libraries without a clear need

## If tests are not added

Explicitly state why, for example:

- documentation-only change
- pure configuration change validated another way
- existing test already covers the behavior
- user requested no tests

Then provide the alternative validation command or manual check.

## Java/Spring Boot default

For this project, prefer JUnit 5 with Spring Boot's existing test dependencies. Keep tests focused and simple; use plain unit tests where a Spring context is unnecessary.

---
name: pre-finish-review
description: Perform a lightweight final quality gate before declaring implementation work complete. Use after code, documentation, configuration, or test changes to inspect the diff, run relevant validation, and report residual risks.
---

# Pre-finish Review

Before saying work is done, complete this checklist in the same session.

## 1. Inspect the actual change

Run or inspect:

```bash
git diff --stat
git diff
```

Check for:

- accidental unrelated edits
- debug prints, TODOs, dead code, commented-out code
- secrets, local paths, or environment-specific values
- unnecessary abstraction or broad rewrites
- docs that exceed project limits

## 2. Validate behavior

Run the narrowest relevant validation command available.

Examples:

```bash
mvn test
./mvnw test
npm test
```

If a full command is too expensive or unavailable, run the closest focused check and explain the limitation.

## 3. Self-review against the request

Confirm:

- the user-requested behavior is implemented
- tests or verification cover the main behavior and one important edge case
- errors are handled deliberately
- the solution is simpler than the obvious overbuilt alternative

## 4. Final response format

Include concise evidence:

- changed files
- validation command and result
- any residual risks or follow-up work

Do not claim completion if validation was not run unless you clearly say why.

# Type-checking rollout

`npm run typecheck` runs TypeScript `checkJs` with `noEmit`; it validates JavaScript contracts without generating build artifacts. It is one stage of `npm run check` and is enforced on Ubuntu Node.js 20/22 in CI.

## Current enforced set

The source of truth is `tsconfig.check.json`. The current set covers:

- AI errors, provider presets, and the outbound privacy gateway.
- AI configuration setup.
- Core document resolution and section editing.
- Strict one-shot response parsing and init progress reporting.
- Low-coupling utilities for constants, file reads, Git, mtimes, prompt output, sensitive-data filtering, and token budgets.

Run the same gate locally with:

```bash
npm run typecheck
```

Do not remove a checked file or weaken compiler options to make the gate pass. A change to an enforced module must keep its JSDoc and runtime validation aligned; new low-coupling modules should be added when introduced.

## Expansion order

Historical JavaScript outside the enforced set is not claimed to be type-clean. Expand coverage in reviewable phases:

1. Adapters and scanner: declare base-adapter return contracts, scan results, and detector option shapes.
2. Commands and generators: type Commander actions as `void` and define prompt, update, continuation, and transaction result objects.
3. Web API: define request configuration, route payloads, AI settings, and scenario-service records.
4. Dashboard: add `vue-tsc` after the server-side JavaScript set is clean.

Each phase must first fix the target files, then expand `tsconfig.check.json` in the same change. Keep `npm run lint`, focused tests, and `npm run typecheck` green before moving to the next group. `npm run check` remains the final release gate.

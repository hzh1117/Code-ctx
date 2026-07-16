# Type-checking rollout

`npm run typecheck` uses TypeScript `checkJs` without emitting files. The first enforced set covers the AI privacy and error boundaries, configuration setup, core document resolution, one-shot parsing, init progress reporting, and low-coupling utilities.

The remaining historical errors are grouped and should be removed in this order:

1. Adapters and scanner: declare the base adapter return contracts and the detector option shape.
2. Commands and generators: type Commander actions as `void` and define prompt/update result objects.
3. Web API: define request configuration and scenario service records.
4. Dashboard: add `vue-tsc` after the server-side JavaScript set is clean.

Each phase expands `tsconfig.check.json`; checked files must not be removed to make the gate pass. New low-coupling modules should be added when introduced.

# Contributing to Code-ctx

Thanks for helping improve Code-ctx. This project is in active development, so small, focused pull requests are easiest to review.

## Development Setup

```bash
git clone https://github.com/hzh1117/Code-ctx.git
cd Code-ctx
npm install
cd web && npm install && cd ..
```

Run the local checks before opening a pull request:

```bash
npm run check
```

## Branches and Commits

- Create a branch from `master`.
- Keep each pull request focused on one feature, bug fix, or documentation change.
- Use clear commit messages. Conventional prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `refactor:` are preferred.

## Pull Request Checklist

- Explain the problem and the solution.
- Include screenshots or terminal output when changing UI or CLI behavior.
- Add or update tests for behavior changes.
- Update README or docs when commands, config, environment variables, or user workflows change.
- Do not commit local secrets, `.env`, generated prompt files, or private project documentation.

## Project Notes

- The CLI entry is `bin/cli.js`.
- Core command implementations live in `src/commands/`.
- The local dashboard API lives in `src/web/`.
- The dashboard frontend is a Vue 3 app in `web/`.
- Built-in project detectors live under `src/adapters/builtin/`.

## Reporting Issues

Use the bug report or feature request templates when possible. For bugs, include:

- Operating system and Node.js version.
- Exact command or dashboard page.
- Expected behavior.
- Actual behavior, including logs or screenshots.
- Minimal reproduction steps.

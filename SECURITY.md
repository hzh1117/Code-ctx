# Security Policy

## Supported Versions

Code-ctx is in active development. Security fixes are applied to the latest version on `master`.

## Reporting a Vulnerability

Please do not open a public issue for sensitive security reports.

Use GitHub's private vulnerability reporting feature when available, or contact the repository owner through GitHub. Include:

- Affected version or commit.
- Reproduction steps.
- Impact and possible data exposure.
- Any relevant logs, with secrets removed.

## Secret Handling

Code-ctx includes a sensitive information filter, but users are still responsible for protecting credentials.

- Do not commit `.env`, API keys, tokens, SSH keys, database URLs, or private prompt output.
- Review generated `ai-docs/` before publishing if they were generated from private code.
- Use `.env.example` for documenting configuration shape without secrets.

## Scope

Relevant reports include:

- Secret leakage in generated docs or prompt output.
- Dashboard API exposure beyond localhost or token checks.
- Path traversal in file-reading routes.
- Unsafe handling of AI provider credentials.

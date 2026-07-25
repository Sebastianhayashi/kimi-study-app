# Security Policy

## Reporting a vulnerability

Do not disclose exploitable vulnerabilities in a public issue. Use GitHub's private vulnerability reporting for this repository when available, or contact the repository owner privately through the profile contact method.

Include:

- affected commit or version;
- reproduction steps;
- expected and observed behavior;
- impact and attack preconditions;
- a minimal proof of concept without real user data;
- suggested mitigation, if known.

## Security boundaries

Lucubro is a local-first experimental application. It starts a web server, accepts uploaded learning materials, writes course workspaces, and launches a locally authenticated `kimi` CLI subprocess. Treat uploaded files and generated HTML as untrusted input.

Contributors must not:

- commit API keys, cookies, Kimi credentials, learner data, or copyrighted source books;
- bypass CAPTCHA, OTP, OAuth, payment, anti-abuse, or production authentication controls;
- weaken archive traversal, path validation, content-type, or workspace isolation checks;
- expose the local server directly to the public internet without an independent security review;
- present test-only compatibility modules or fixtures as production security controls.

## Supported versions

Security fixes are applied to the current `main` branch. Until a stable release is published, older snapshots are not guaranteed to receive patches.

## Deployment warning

The repository is not a hardened multi-tenant SaaS. Before any public deployment, add authenticated access, process isolation, resource quotas, upload scanning, secret management, rate limiting, audit logging, and a reviewed sandbox for generated content.

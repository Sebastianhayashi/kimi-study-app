# UX E2E sample reports

These reports document a fresh browser audit of a Kimi Study source snapshot. They are published as engineering evidence and as an example of the repository's quality bar.

- [`kimi-study-ux-e2e-report.zh-CN.pdf`](kimi-study-ux-e2e-report.zh-CN.pdf) — Chinese report
- [`kimi-study-ux-e2e-report.en-US.pdf`](kimi-study-ux-e2e-report.en-US.pdf) — English report
- [`SHA256SUMS.txt`](SHA256SUMS.txt) — file integrity checksums

The audited original snapshot was judged `NO_GO` because a terminal generation failure left surrounding regions in a running state and displayed duplicate primary progress surfaces. The repository update includes the focused repair and regression coverage described in the report. External Kimi model responses and some vendor rendering paths remained blocked in the audit environment and are not represented as successful production validation.

Do not treat a historical report as proof that a later commit was executed. Current changes must rely on current CI and fresh local evidence.

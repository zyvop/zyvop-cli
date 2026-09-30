# Agent Tooling

## The Keep the Why skill remains a local install

**Id:** f6addd80-fbae-4ed5-a18b-d8b051e67552
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-30; .gitignore; AGENTS.md; skills-lock.json
**Verification:** corroborated
**Revisit when:** the project chooses to vendor or otherwise share agent skill files

The installed skill under `.agents/skills/` is ignored by Git; `skills-lock.json`
tracks its source, and `AGENTS.md` points to the local installation. This keeps
the skill files out of GitHub pushes, but a fresh checkout needs its local skill
installation before that path can be read.

**Reason:** keep the skill package local rather than include `.agents/` in the
repository.

**Rejected alternative:** track the installed `.agents/` files in Git. The
maintainer explicitly asked to keep that directory out of pushes.

## GitHub Pages publishes the project dashboard

**Id:** 591ef816-419d-47ea-9fe0-3c1008dbdf7c
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** maintainer conversation, 2026-09-30; .keep-the-why; .github/workflows/ktw-dashboard.yml; index.html
**Verification:** corroborated
**Revisit when:** the repository visibility, Pages hosting, or context privacy requirements change

The GitHub Pages workflow exports the context dashboard to
`/dashboard/live/`. The root `index.html` links to it because the dashboard
export alone does not provide a Pages root page.

**Reason:** make the context dashboard publicly browsable through this
repository's Pages site. The maintainer chose public hosting after the initial
deployment showed a root-page 404.

**Rejected alternative:** leave the context dashboard local or unpublished.
Public Pages publishing was explicitly selected.

## Dashboard exports anonymize commit authors

**Id:** 6f39c3e4-2ffd-4994-b16a-8543bd0bc343
**Type:** decision
**Status:** active
**Evidence:** unknown
**Source:** maintainer conversation, 2026-09-30; .github/workflows/ktw-dashboard.yml
**Verification:** corroborated
**Revisit when:** the project's attribution or privacy policy changes

The dashboard export runs with `--anonymize`, so commit authors are not shown
under their Git identities. The setting was explicitly selected for the public
dashboard; the reason for preferring anonymized names over visible attribution
was not stated.

**Rejected alternative:** show Git author names in the dashboard. This option
was considered and not selected; why it was rejected is unknown.
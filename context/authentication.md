# Authentication

## Provider credentials stay with local cross-posting

**Id:** f5156fef-8c85-47e7-889f-f5540d57254a
**Type:** decision
**Type:** constraint
**Status:** active
**Evidence:** confirmed
**Source:** git commit 5683767; README.md; src/commands/publish.js; src/local-cross-post.js; test/local-cross-post.test.js
**Verification:** corroborated
**Revisit when:** the provider credential flow or server-side syndication contract changes

In `--local` mode, provider credentials are read from the current process
environment and sent only to the selected destination. The article is still
sent to ZyVOP, but the CLI disables server-side cross-posting in that request;
provider credentials are neither uploaded to ZyVOP nor saved in the CLI config.

**Reason:** keep provider credentials under the caller's control while allowing
the CLI to publish directly to external providers.

**Rejected alternative:** send provider credentials to ZyVOP for server-side
syndication. That would cross the credential boundary this mode is designed to
preserve.

## CLI login credentials use owner-only file permissions

**Id:** d0d58b38-0802-4bc1-98ea-5f2694b15d2b
**Type:** constraint
**Status:** active
**Evidence:** inferred
**Source:** src/config.js; README.md
**Verification:** corroborated
**Revisit when:** the CLI credential storage mechanism changes

When a login token is persisted, the CLI stores it in `~/.zyvop/config.json`
and sets the containing directory to mode `0700` and the file to mode `0600`.

**Reason:** the restrictive permissions limit access to the current OS user.
The original rationale and threat model are not recorded; this explanation is
inferred from the file modes.

**Rejected alternative:** unknown; no competing storage or permission scheme
is recorded.
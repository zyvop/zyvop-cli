# Publishing

## Stable identities make repeat publishes update existing articles

**Id:** f909fd67-a210-4e84-b3f6-1b1b4ffbcc56
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** git commits c19cc58 and 5683767; README.md; test/api.test.js; test/cli.test.js; test/local-cross-post.test.js
**Verification:** corroborated
**Revisit when:** ZyVOP or a destination changes its article lookup or update API

The CLI uses stable identifiers to target updates instead of creating a new
article on every run. ZyVOP password-session publishing looks up an owned post
by `zyvop_id`/`id` or `slug`; developer-token publishing can match by
`canonical_url`. Local cross-posting matches Dev.to and Hashnode by canonical
URL, WordPress by slug, and Bluesky by a deterministic record key. Medium's
API does not support updating a published story, so repeated local publishes
can create another story there.

**Reason:** stable identifiers support repeatable Git-based publishing while
keeping updates scoped to articles the account can identify as its own.

**Rejected alternative:** unknown; the source material does not record another
identity or reconciliation strategy.

## Preserve frontmatter owned by the source site

**Id:** fb023ed8-a937-4be6-b2f6-b527821c5bfd
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** git commit c19cc58; README.md; src/publish-payload.js; test/publish-payload.test.js
**Verification:** corroborated
**Revisit when:** the Markdown payload contract or dual-use repository support changes

The normalized developer-token Markdown retains unrecognized YAML frontmatter
keys while replacing ZyVOP fields with normalized values. This lets the same
article keep metadata used by a site generator such as Next.js, Astro, Hugo,
or Contentlayer.

**Reason:** article repositories can serve both ZyVOP and their own site
generator without losing generator-specific metadata during publishing.

**Rejected alternative:** strip fields outside ZyVOP's schema. That would
discard metadata the source site still needs.

## Resolve relative assets from an explicit site base

**Id:** 459fcb9f-14f9-4061-a9ba-d1a068cdd882
**Type:** decision
**Type:** constraint
**Status:** active
**Evidence:** inferred
**Source:** git commit 293ab43; README.md; src/publish-payload.js; test/publish-payload.test.js
**Verification:** corroborated
**Revisit when:** URL resolution or accepted asset protocols change

Relative cover and Markdown image URLs are resolved using `base_url`,
`--base-url`, or the origin of `canonical_url`. A relative cover without a
resolvable base is rejected. When a base is supplied, resolved cover and body
image URLs must use HTTP or HTTPS; without a base, Markdown body content is
left unchanged.

**Reason:** resolving root-relative and file-relative assets supports
Git-backed articles while restricting published assets to web URLs. The
protocol restriction's original security rationale is inferred from the
validation and tests.

**Rejected alternative:** accept non-HTTP schemes or guess a base for a
relative URL. The CLI rejects these cases rather than publishing an ambiguous
or unsupported asset reference.

## Dry-run stays local and read-only

**Id:** 3d3e2105-7849-43c9-8b31-756e38aee3c1
**Type:** decision
**Type:** constraint
**Status:** active
**Evidence:** confirmed
**Source:** git commit 293ab43; README.md; src/commands/publish.js; test/cli.test.js
**Verification:** corroborated
**Revisit when:** dry-run begins making network requests or writing to a remote service

`--dry-run` validates and displays the normalized payload without authenticating
or contacting ZyVOP or any provider. It therefore cannot report the server's
final create-versus-update decision; that is reported by a real publish.

**Reason:** a preview remains safe to run without credentials or remote side
effects, including when the configured endpoint is unavailable.

**Rejected alternative:** query the server during dry-run to predict whether a
post would be created or updated. That would make the preview network-dependent
and require authentication.

## An omitted status does not overwrite an existing status

**Id:** cba2cabc-f781-4c99-899e-aa567c0f75aa
**Type:** decision
**Status:** active
**Evidence:** inferred
**Source:** src/publish-payload.js; src/commands/publish.js; test/publish-payload.test.js; test/cli.test.js
**Verification:** corroborated
**Revisit when:** default status or update mutation semantics change

The CLI treats an article with no explicit status as published for a new
publish, but omits the status field from normalized update payloads unless the
caller supplied a status, draft flag, or equivalent frontmatter value.

**Reason:** an update should not change an existing post's status merely
because the CLI's default for a new post is `PUBLISHED`. This is inferred from
the `statusExplicit` behavior and the test that ensures an existing draft stays
a draft.

**Rejected alternative:** always serialize the default `PUBLISHED` status.
That would turn an existing draft into a published post during an otherwise
content-only update.
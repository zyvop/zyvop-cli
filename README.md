# ZyVOP CLI

Command-line client for publishing Markdown articles to ZyVOP and cross-posting to Dev.to, Hashnode, Medium, WordPress, and Bluesky.

---

## Installation

Run directly with `npx`:

```bash
npx zyvop --help
```

Or install globally via npm:

```bash
npm install -g zyvop
```

---

## Quick Start

### 1. Authenticate

```bash
zyvop login
```

You can pass credentials interactively, or supply an API token via flag / environment variable:

```bash
zyvop login --token <your_token>
# or set ZYVOP_TOKEN in your environment
```

Verify your session:

```bash
zyvop whoami
```

---

### 2. Publish a Markdown Article

Create a Markdown file with YAML frontmatter:

```markdown
---
title: Building Scalable Microservices with Go
subtitle: A practical deep-dive into distributed architecture
tags: [golang, backend, microservices, docker]
canonical_url: https://myblog.com/go-microservices
base_url: https://myblog.com/
category: backend
generate_toc: true
cross_post:
  devto: true
  hashnode: true
  medium: true
  wordpress: true
  bluesky: true
---

# 1. Introduction

Your article content here with code snippets, tables, and diagrams...
```

Publish and syndicate:

```bash
zyvop publish ./my-article.md
```

ZyVOP will:

1. Parse the frontmatter and render Markdown into semantic HTML.
2. Publish the post to ZyVOP.
3. Queue background workers to syndicate the article to Dev.to, Hashnode, Medium, WordPress, and Bluesky.
4. Set canonical URL headers on all targets pointing to your primary post.

---

## Command Reference

### `zyvop publish <file>`

Publishes or updates a Markdown file to ZyVOP and connected syndication targets.

| Flag                           | Description                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `-d, --dry-run`                | Locally validate and preview the exact payload without authentication or publishing |
| `--base-url <url>`             | Base URL for resolving relative image links (e.g. `/blog/cover.webp`)               |
| `--title <string>`             | Override article title                                                              |
| `--subtitle <string>`          | Subtitle or description                                                             |
| `--tags <list>`                | Comma-separated tags (e.g. `react,nextjs,typescript`)                               |
| `--category <slug>`            | Category slug (e.g. `frontend`, `backend`, `devops`)                                |
| `--canonical <url>`            | Custom canonical URL for SEO                                                        |
| `--cover <url>`                | Header cover image URL (absolute or relative to `--base-url`/`canonical_url`)       |
| `--draft`                      | Save as draft instead of publishing live                                            |
| `--toc`                        | Generate and render a floating Table of Contents                                    |
| `--devto` / `--no-devto`       | Explicitly enable / disable Dev.to cross-posting                                    |
| `--hashnode` / `--no-hashnode` | Explicitly enable / disable Hashnode cross-posting                                  |
| `--medium` / `--no-medium`     | Explicitly enable / disable Medium cross-posting                                    |
| `--bluesky` / `--no-bluesky`   | Explicitly enable / disable Bluesky link broadcast                                  |
| `--wordpress`                  | Enable WordPress cross-posting                                                      |
| `-t, --token <token>`          | ZyVOP API token (overrides stored token)                                            |
| `--endpoint <url>`             | Custom GraphQL endpoint URL                                                         |

---

## Frontmatter Compatibility & Dual-Use Repositories

ZyVOP is built for Git-backed and headless blogging workflows.

- **Safe Extra Frontmatter:** Keep custom fields required by Next.js, Contentlayer, Astro, Hugo, or another site generator. The CLI preserves unknown keys in the developer-token payload, while ZyVOP ignores fields outside its API schema.
- **Relative Images:** Root-relative (`/blog/cover.webp`) and file-relative (`./cover.webp` or `../cover.webp`) cover and body images are resolved with `base_url`, `--base-url`, or the origin of `canonical_url`. Only HTTP(S) base URLs are accepted.
- **Consistent Overrides:** Developer-token publishing sends the same normalized values shown by `--dry-run`, including cover, status, tags, and cross-post flags.
- **Update vs. Create:** With a developer token (`zv_...`), the API reports whether it created or updated the post. Use a stable `canonical_url`, `zyvop_id`, `id`, or `slug` in frontmatter for repeatable Git publishing. Password-session GraphQL publishing updates only when `zyvop_id`/`id` or `slug` identifies an owned post; otherwise it creates a post.

Dry-run is intentionally local and read-only:

```bash
zyvop publish ./my-article.md --dry-run --base-url https://myblog.com/
```

It validates and displays the payload and requested syndication targets without requiring a token. Because it does not contact ZyVOP or external platforms, final create/update decisions are reported only by the real publish command.

---

### `zyvop import <source> <identifier>`

Imports past articles from existing blogging platforms into your ZyVOP dashboard:

```bash
# Import from Dev.to
zyvop import devto myusername

# Import from Hashnode
zyvop import hashnode myblog.hashnode.dev
```

---

### `zyvop whoami`

Prints the current authenticated user profile, email, and connected endpoint.

---

### `zyvop logout`

Clears the local credentials stored in `~/.zyvop/config.json`.

---

## Continuous Deployment (GitHub Actions)

To automatically publish new and modified articles whenever you push to your repository, create a developer token in ZyVOP and store it as the `ZYVOP_TOKEN` repository secret. Give every article a stable `canonical_url` or `zyvop_id` so repeat publishes can be matched safely.

```yaml
# .github/workflows/publish.yml
name: Publish to ZyVOP

on:
  push:
    branches: [main]
    paths:
      - "posts/**.md"

permissions:
  contents: read

# Do not let rapid pushes publish the same article concurrently.
concurrency:
  group: zyvop-publish-${{ github.ref }}
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Detect Changed Markdown Posts & Publish
        env:
          ZYVOP_TOKEN: ${{ secrets.ZYVOP_TOKEN }}
        run: |
          set -euo pipefail

          before="${{ github.event.before }}"
          after="${{ github.sha }}"

          # A branch's first push has an all-zero before SHA. A force push can
          # also reference an unavailable commit, so publish all tracked posts.
          if [[ "$before" =~ ^0+$ ]] || ! git cat-file -e "$before^{commit}" 2>/dev/null; then
            mapfile -d '' files < <(git ls-files -z -- ':(glob)posts/**/*.md')
          else
            mapfile -d '' files < <(
              git diff --name-only -z --diff-filter=ACMR \
                "$before" "$after" -- ':(glob)posts/**/*.md'
            )
          fi

          if (( ${#files[@]} == 0 )); then
            echo "No Markdown files changed."
            exit 0
          fi

          for file in "${files[@]}"; do
            if [ -f "$file" ]; then
              echo "Deploying $file..."
              npx --yes zyvop@1.0.10 publish "$file"
            fi
          done
```

---

## License

MIT © [ZyVOP](https://zyvop.com)

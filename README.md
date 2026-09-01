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

| Flag                           | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `-d, --dry-run`                | Preview resolved frontmatter, image URLs, and syndication targets without publishing |
| `--base-url <url>`             | Base URL for resolving relative image links (e.g. `/blog/cover.webp`)                |
| `--title <string>`             | Override article title                                                               |
| `--subtitle <string>`          | Subtitle or description                                                              |
| `--tags <list>`                | Comma-separated tags (e.g. `react,nextjs,typescript`)                                |
| `--category <slug>`            | Category slug (e.g. `frontend`, `backend`, `devops`)                                 |
| `--canonical <url>`            | Custom canonical URL for SEO                                                         |
| `--cover <url>`                | Header cover image URL (absolute or relative to `--base-url`/`canonical_url`)        |
| `--draft`                      | Save as draft instead of publishing live                                             |
| `--toc`                        | Generate and render a floating Table of Contents                                     |
| `--devto` / `--no-devto`       | Explicitly enable / disable Dev.to cross-posting                                     |
| `--hashnode` / `--no-hashnode` | Explicitly enable / disable Hashnode cross-posting                                   |
| `--medium` / `--no-medium`     | Explicitly enable / disable Medium cross-posting                                     |
| `--bluesky` / `--no-bluesky`   | Explicitly enable / disable Bluesky link broadcast                                   |
| `--wordpress`                  | Enable WordPress cross-posting                                                       |
| `-t, --token <token>`          | ZyVOP API token (overrides stored token)                                             |
| `--endpoint <url>`             | Custom GraphQL endpoint URL                                                          |

---

## Frontmatter Compatibility & Dual-Use Repositories

ZyVOP is built for Git-backed and headless blogging workflows.

- **Safe Extra Frontmatter:** You can safely keep any custom frontmatter fields required by your own site generator (e.g. Next.js, Contentlayer, Astro, Hugo such as `layout`, `readingTime`, `author`, `featured`). Unknown keys are safely ignored and will never cause validation errors.
- **Relative Images:** Relative paths for `cover_image` (e.g. `/blog/cover.webp`) and markdown body images are automatically resolved against your `base_url` frontmatter key or `canonical_url` domain.
- **Idempotent Upsert (Update vs. Create):** Re-publishing an existing article updates the existing post on ZyVOP and only broadcasts to platforms that haven't been synced yet, preventing duplicate posts.

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

To automatically publish new and modified articles whenever you push to your repository:

```yaml
# .github/workflows/publish.yml
name: Publish to ZyVOP

on:
  push:
    branches: [main]
    paths:
      - "posts/**.md"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Fetch previous commit to calculate diffs

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Detect Changed Markdown Posts & Publish
        env:
          ZYVOP_TOKEN: ${{ secrets.ZYVOP_TOKEN }}
        run: |
          # Get list of added or modified markdown files
          FILES=$(git diff --name-only --diff-filter=ACMR HEAD~1 HEAD | grep '^posts/.*\.md$' || true)
          if [ -z "$FILES" ]; then
            echo "No Markdown files changed."
            exit 0
          fi

          for file in $FILES; do
            if [ -f "$file" ]; then
              echo "Deploying $file..."
              npx zyvop publish "$file"
            fi
          done
```

---

## License

MIT © [ZyVOP](https://zyvop.com)

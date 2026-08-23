# ZyVOP CLI

Command-line client for publishing Markdown articles to ZyVOP and cross-posting to Dev.to, Hashnode, Medium, and Bluesky.

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
3. Queue background workers to syndicate the article to Dev.to, Hashnode, Medium, and Bluesky.
4. Set canonical URL headers on all targets to preserve SEO ownership.

---

## Command Reference

### `zyvop publish <file>`

Publishes a Markdown file to ZyVOP and connected syndication targets.

| Flag | Description |
|---|---|
| `--title <string>` | Override article title |
| `--subtitle <string>` | Subtitle or description |
| `--tags <list>` | Comma-separated tags (e.g. `react,nextjs,typescript`) |
| `--category <slug>` | Category slug (e.g. `frontend`, `backend`, `devops`) |
| `--canonical <url>` | Custom canonical URL for SEO |
| `--cover <url>` | Header cover image URL |
| `--draft` | Save as draft instead of publishing live |
| `--toc` | Generate and render a floating Table of Contents |
| `--devto` / `--no-devto` | Explicitly enable / disable Dev.to cross-posting |
| `--hashnode` / `--no-hashnode` | Explicitly enable / disable Hashnode cross-posting |
| `--medium` / `--no-medium` | Explicitly enable / disable Medium cross-posting |
| `--bluesky` / `--no-bluesky` | Explicitly enable / disable Bluesky link broadcast |
| `--wordpress` | Enable WordPress cross-posting |
| `-t, --token <token>` | ZyVOP API token (overrides stored token) |
| `--endpoint <url>` | Custom GraphQL endpoint URL |

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

To automatically publish whenever you push Markdown files to your repository:

```yaml
# .github/workflows/publish.yml
name: Publish to ZyVOP

on:
  push:
    branches: [main]
    paths:
      - 'posts/**.md'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Publish posts via ZyVOP CLI
        env:
          ZYVOP_TOKEN: ${{ secrets.ZYVOP_TOKEN }}
        run: |
          for file in posts/*.md; do
            npx zyvop publish "$file"
          done
```

---

## License

MIT © [ZyVOP](https://zyvop.com)

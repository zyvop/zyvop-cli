---
title: Testing ZyVOP CLI Full Metadata Suite
subtitle: A complete demonstration of frontmatter, code blocks, and cross-posting
excerpt: Learn how to publish and syndicate developer articles with custom SEO, cover images, and automated cross-posting.
cover_image: https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80
tags: [typescript, golang, devops, automation]
category: backend
canonical_url: https://myblog.com/zyvop-cli-suite
meta_title: Master ZyVOP CLI Publishing & Syndication
meta_description: Learn how to publish Markdown articles with full metadata using the official ZyVOP CLI.
og_title: Master ZyVOP CLI Publishing & Syndication
og_description: Learn how to publish Markdown articles with full metadata using the official ZyVOP CLI.
generate_toc: true
comments_enabled: true
status: PUBLISHED
cross_post:
  devto: false
  hashnode: false
  medium: false
  bluesky: false
  wordpress: false
---

# Complete Metadata Showcase 🚀

This article demonstrates every metadata feature supported by ZyVOP:

## 1. Features Highlighted

- **Cover Image:** Displayed at the top of the article and social shares.
- **Subtitle & Excerpt:** Used for article summaries and Google search snippets.
- **SEO & Open Graph:** Custom search engine titles/descriptions and social share card overrides.
- **Tags & Category:** Automatically categorizes your article into backend/frontend tag feeds.
- **Canonical URL:** Protects your domain authority on search engines.
- **Table of Contents:** Auto-generated from headings.
- **Syndication Targets:** Cross-posts simultaneously to Dev.to, Hashnode, Medium, Bluesky, and WordPress.

## 2. Sample Code Block

```typescript
interface ArticleConfig {
  title: string;
  coverImage?: string;
  tags: string[];
  canonicalUrl?: string;
  crossPost: {
    devto: boolean;
    hashnode: boolean;
    medium: boolean;
    bluesky: boolean;
    wordpress: boolean;
  };
}

const config: ArticleConfig = {
  title: "Building with ZyVOP",
  tags: ["typescript", "cli"],
  crossPost: {
    devto: true,
    hashnode: true,
    medium: false,
    bluesky: true,
    wordpress: false,
  },
};

console.log("Publishing article:", config.title);
```

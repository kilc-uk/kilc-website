# Contributing to KILC Website

## Stack

- **Astro 5** — static site generator, file-based routing
- **Tailwind CSS 3** — utility-first styling with custom brand tokens
- **TypeScript** — strict type checking via `tsconfig.json`
- **i18n** — English (`/`) + Chinese (`/zh/`) with alternate slugs

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at http://localhost:4321 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npx astro sync` | Generate `.astro/` types (run before `tsc`) |
| `npx tsc --noEmit` | Type check without emitting files |

## Development Workflow

1. `npm run dev` — start local server
2. Make changes — Astro hot-reloads
3. `npx astro sync && npx tsc --noEmit` — confirm types pass
4. `npm run build` — confirm 42 pages build with zero errors
5. Commit and push to `main` — CI deploys automatically

## Adding a New Page

```bash
# 1. Create the EN page
touch src/pages/new-page.astro

# 2. Create the ZH page
touch src/pages/zh/new-page.astro

# 3. Add translation keys to both i18n files
# src/i18n/en.json + src/i18n/zh.json

# 4. If the ZH slug differs from EN, add to zhSlugMap in src/i18n/utils.ts

# 5. Build to validate
npm run build
```

## Adding a Translation Key

1. Add the key to `src/i18n/en.json`
2. Add the same key to `src/i18n/zh.json`
3. Use in any `.astro` file: `t(locale, 'section.key')`

## Hero Images

Each page must have a **unique** hero background image. Available images are in `public/images/hero/` and `public/images/services/`. When adding a page, assign a unique image not already used by another page via the `backgroundImage` prop on `<Hero>`.

## Styling

- Use Tailwind utility classes for all styling
- Use named brand tokens (`bg-brand-primary`, `text-brand-dark`, etc.) — never hardcode hex values in templates
- Custom utilities go in `src/styles/global.css`

## CMS (Decap CMS)

The site includes a Git-based CMS at `https://kilc.co.uk/admin/`.

- **Config**: `public/admin/config.yml` — defines collections and fields
- **OAuth proxy**: Cloudflare Worker at `https://sveltia-cms-auth.shy-star-b244.workers.dev`
- **Login**: GitHub account — must be a collaborator on `kilc-uk/kilc-website`

### Giving a colleague CMS access

1. Add their GitHub account as a collaborator: repo **Settings → Collaborators → Add people**
2. They visit `https://kilc.co.uk/admin/` and click **Login with GitHub**

### Adding a new CMS collection

1. Add a new folder under `src/content/<collection>/en/` and `src/content/<collection>/zh/`
2. Define the schema in `src/content.config.ts`
3. Add the collection to `public/admin/config.yml` (both EN and ZH variants)
4. Update the relevant page to query via `getCollection('<collection>')`

### Blog Posts

Blog posts live in `src/content/blog/en/` as Markdown files. Each file requires this frontmatter:

```yaml
---
title: "Post title"
date: "2026-01-01"
author: "Author name"
coverImage: "/images/..."   # optional
tags: ["Tag One", "Tag Two"] # optional
excerpt: "One-paragraph summary shown on the card grid."
featured: false              # true = pinned to top of /blogs
---
```

The blog overview is at `/blogs` — it auto-generates cards from all `.md` files in the folder. Add a new post via the CMS (`/admin/` → **Blog Posts (English)**) or directly commit the `.md` file.

### Environment variables

This is a static site — no `.env` file is required. All secrets (GitHub OAuth) are stored as Cloudflare Worker secrets and never committed to the repo.

## Before Committing

```bash
npm run build              # Must succeed — no warnings, 42 pages
npx astro sync
npx tsc --noEmit           # Must succeed — zero type errors
git status                 # Review changed files
```

Never commit if either check fails.

# Tutorials

This folder stores reusable tutorial "bricks" that can be composed into
workflow-specific guides for different clients. Bricks are Markdown files with
front matter so they are easy to search and reassemble.

## Brick format

Each brick lives in `tutorials/bricks/` and uses this front-matter schema:

```
---
id: place-brick
title: Place a Brick
summary: Add a new brick to the canvas
tags: [core, layout]
screenshots:
  - ../assets/place-brick-01.png
prerequisites: []
---
```

Recommended sections in each brick:

- Goal: one sentence
- When to use: short context
- Steps: numbered list
- Variations: optional
- Related bricks: optional

## Workflow format

Workflows are stored in `tutorials/workflows/` and list bricks in order:

```
---
id: default-workflow
title: Standard workflow
bricks:
  - place-brick
  - add-tutorial-to-brick
  - client-variant
---
```

The body can include notes or client-specific details.

## Assets

Store screenshots in `tutorials/assets/`. Use consistent names like
`<brick-id>-01.png` so references stay stable.

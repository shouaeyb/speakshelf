# Design system and copy voice

The look is IBM Carbon inspired: engineered, boxy, quiet. The implementation is the source of truth, and it is a set of sheets, not one file: `app/globals.css` is the manifest, carrying no rules of its own and importing `app/styles/base.css`, `app/styles/explorer.css` and `app/styles/site.css` in that order. Import order is the cascade, so a rule's sheet and its position in it both matter. This page explains the intent so changes stay coherent.

## Tokens

All colors, spacing and type run through the CSS variables at the top of `app/styles/base.css`, the first sheet the manifest imports. The palette, by role:

| Role | Value |
| --- | --- |
| Page background | #f4f4f4 |
| Layer (cards, rows, fields) | #ffffff |
| Borders | #e0e0e0, strong #8d8d8d |
| Text | #161616, secondary #525252, tertiary #6f6f6f |
| Inverse sections (hero, subheads, footer) | #161616 background, secondary text #a8a8a8 |
| The blue | #0f62fe, soft #78a9ff |
| Tag blue | #d0e2ff on #0043ce |
| Tag purple (ultra tier) | #e8daff on #6929c4 |

## The mark

The Speakshelf mark is two small offset squares on a diagonal, blue top left, companion bottom right, living on a dark #161616 ground. The geometry is fixed by the favicon and must hold at every size: each square is 45% of the cluster box and the diagonal gap is 10%, so the pair nearly touches and reads as one glyph, never as two floating dots.

Where the ground comes from differs by surface. The masthead sits on white, so it renders the favicon itself (`/icon.svg`, tile and all), which also makes the header match the browser tab above it. The footer and the OG card are already dark, so they use the bare squares (`.wordmark-sq`, companion square via currentColor) and the surface is the tile. Keep favicon, masthead, footer and OG card in step.

Rules that make it Carbon: border radius is 0 everywhere, hairline 1px borders, grids with 1px gaps showing the border color through, IBM Plex Sans for prose and IBM Plex Mono for labels, codes and counts. Type gets light weights at display sizes (300) and the scale uses clamp() in the hero. Motion is minimal: the staggered `.rise` on load, the `.eq` equalizer on a playing row, and the loading spinner, all gated behind prefers-reduced-motion. Multiline text is always start-aligned (left in LTR, right in RTL), even in blocks positioned at the far side (the footer note): flush-end multiline has a ragged start edge that slows reading, and Carbon sets body copy at the start. End alignment is reserved for single short items like a count in a cell.

Every provider section present and future uses this same sheet. Provider identity comes from words (the eyebrow label, breadcrumbs), never from a palette swap. The one permitted differentiator, and only with owner sign-off, is the tag accent hue.

## Components in the wild

Masthead (sticky, 48px) with global provider tabs (active provider underlined in blue, short labels under 560px), hero with stat row and mono section jump links, family tiles (grid columns follow the tile count below five, so sparse providers show no dead cells), umbrella provider cards (`.prov-card`: mono `/KEY`, name, big count, mono meta, blurb, BROWSE line), the umbrella "why" tiles, dark language band, boxy toolbar (5, 4 or 3 fields; the family filter label uses the provider's own word), voice rows with play button states (play, spinner, equalizer, error note), sticky language group heads, footer. Reuse these before inventing anything.

Provider identity is words, never palette: the eyebrow, the vocabulary ("engines" on /polly, "model families" on /google), the copy. One token sheet serves every page.

## The explorer on a narrow screen

Under 721px the explorer takes a different shape, and nothing is lost to the width. The toolbar keeps the search field alone, so the list starts near the top of the screen instead of under a stack of boxes. A boxed FILTERS button fills its own row above the list and carries the number of select filters in play; the result count and clear-all wrap onto the line beneath it, count at the start and clear-all at the end. It is the only way into the filters at this width, so it reads as a control rather than as one item in a line of text. It opens a full-screen panel with a white header (title, close control), the same fields stacked one per row on the toolbar's 1px grid, and a footer where clear-all sits beside a blue button naming the count it will reveal. Voice rows become two lines and keep the desktop reading order on the first: the name, the styles beside it, the gender at the line end. The second line carries the model story, the family tag, the sub-model that row would play and the trait tag, indented to the name's edge because the play button's tap target owns the start of both lines. The eye meets the voice first and the machinery second. The button itself keeps its 32px square; only the touch area grows. The two form controls reach 16px on touch, which is what stops iOS Safari zooming the page when a field takes focus. The desktop layout is preserved: the layout rules live in media queries and the panel opens only from the mobile FILTERS button. The one deliberate spillover is the 16px control size, which the coarse-pointer condition extends to wide touch screens, where the same focus zoom applies.

## Copy voice

Shipped writing sounds like a person who knows the subject. Concretely:

- No em dashes, and no en dashes doing an em dash's job. Commas, colons and full stops carry the rhythm.
- No AI boilerplate: never "delve", "seamless", "unleash", "elevate", "comprehensive suite", "in today's world".
- Plain claims, verified numbers. "One of the largest catalogs", not "the largest", unless proven.
- Prefer the modest claim over the impressive one: name what the data proves instead of counting what needs interpreting. A set difference of language codes is not "12 languages the other lacks" when two codes can mean one language; the safe sentence names the one real gap and calls variants variants (see the umbrella coverage cell).
- Cached share surfaces (the og.png card, og and twitter titles and descriptions) carry no counts, and they name one provider fewer than the shelf plus "and more", so the cached line stays literally true when the next provider lands. Live pages name every provider exactly.
- Counts and names derive from data in page code, so prose cannot go stale (see the About section for the pattern).
- Sentence case headings. Mono uppercase is reserved for small labels.

## The design workflow, and who can use it

New surfaces get designed before they get built: mock the page, screenshot it at desktop and mobile widths, fix what looks wrong, then port to the app. Mockups live in the owner's Claude Design project (id 7f79551f-ae78-45a9-ae93-b282a7b105a8). "Speakshelf Umbrella.dc.html" and "Speakshelf Provider Chrome.dc.html" are the 2026-08-13 multi-provider mockups, kept in step with what shipped; "Voice Atlas.dc.html" predates the rename and is history, not truth.

Not every agent has Claude Design tools, and that must never block work:

- If you have access (the mcp claude-design tools are in your toolset): mock there, keep the artifact roughly in sync when you change the app's look, and note the sync state here.
- If you do not: design directly against the stylesheet set in a branch of the real app (the sheet your rules belong in, reached from the `app/globals.css` manifest), and verify with headless browser screenshots (the Playwright pattern in `AGENTS.md`). The repo is always the source of truth either way.

## Verification bar for UI work

Before calling visual work done: build and run the production server, screenshot desktop (1280 or 1440), tablet (860) and mobile (390) widths, click-test one real sample playback, and check that no text touches the viewport edge (the shell owes every width a 24px gutter).

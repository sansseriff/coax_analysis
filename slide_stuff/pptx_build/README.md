# pptx_build — the Svelte deck as a PowerPoint file

Rebuilds `slides/` (the SvelteKit deck) as `output/coax-projections.pptx`: seven
native slides of real text boxes and shapes, not screenshots. Text stays
selectable and editable, colours and fonts match the deck.

## Why it's built this way

Two things in the deck are hard to port to Python, and neither is ported.

**The numbers** come from the TypeScript coax model in `slides/src/lib/physics/`.
Re-implementing Pozar conductor loss and the cryostat conduction model in Python
would give us a second source of truth that silently drifts. Instead
`dump-slide-data.ts` calls the *same* library the deck calls and emits the
already-formatted display strings.

**The layout** is flexbox, CSS grid and line breaking. Rather than emulate that,
`dump-layout.mjs` renders the real deck in headless Chrome — at the exact
viewport and zoom `export-slides.mjs` uses for the reference PNGs — then walks
the DOM and records, in CSS px relative to the slide box:

- every background/border box,
- every **rendered line** of text, as its tight ink rectangle plus the styled
  runs on it,
- the cable cross-sections, re-shot as transparent 12× PNGs.

`render.py` then does pure placement. It knows nothing about coax; it turns
boxes into autoshapes and lines of text into non-wrapping, vertically centred
text boxes. Chrome has already decided where every glyph goes.

## Grouping

`GROUPS` in `dump-layout.mjs` maps a CSS selector to a PowerPoint group name.
Any element matching one becomes a `<p:grpSp>` holding everything painted inside
it, so a grey pill travels with the text on top of it and a number travels with
its unit:

| Selector    | Group name        | Holds                              |
| ----------- | ----------------- | ---------------------------------- |
| `.icard`    | Cable spec card   | accent bar, name, spec list         |
| `.card`     | Cable card        | the whole cable column, nested      |
| `.chip`     | Spec chip         | rounded grey rect + label + value   |
| `.stat`     | Metric row        | key + value + unit                  |
| `tbody tr`  | Summary row       | one length across both cables       |

The list is deliberately shallow — HTML nests far more deeply than is useful to
someone dragging shapes around a slide. Add or remove a line to change it;
grouping is purely structural and moves nothing.

## How general is this?

`render.py` is fully generic — it only understands boxes, lines of text and
pictures. `dump-layout.mjs` is generic over *layout* (any flexbox, grid, table
or text wrapping works, because Chrome resolves it) but understands only a
subset of *painting*. A new HTML deck will mostly work. What it does **not**
carry across, silently unless noted:

- **Backgrounds** — solid colours only. Gradients and `background-image` are
  dropped (only `background-color` is read).
- **Borders** — width and colour per side; `dashed`/`dotted` render solid, and
  only the top-left `border-radius` is read, so per-corner radii are lost.
- **`::before` / `::after`** — invisible to a `childNodes` walk, so pseudo-element
  content and its decoration vanish. Same for list markers.
- **`box-shadow`, `filter`, `opacity` on containers, `transform`/rotation,
  `mix-blend-mode`** — all ignored.
- **Clipping** — `overflow: hidden` has no pptx equivalent; content that the
  browser clips will be drawn in full.
- **Stacking** — paint order is DOM order. `z-index` and negative stacking
  contexts are not honoured.
- **Decorated inline elements** — consumed as text runs, so a background or
  border on a `<span>` is lost. The dump *warns* when it sees one.
- **`text-decoration`** (underline, strikethrough) and `vertical-align`
  (sub/superscript) are not carried.
- **`<canvas>`, `<video>`, `<img>`, `<iframe>`** — no node kind exists for them,
  so they silently disappear. Only `<svg>` is special-cased, captured as a
  transparent raster picture; a chart therefore arrives as an image rather than
  as editable pptx shapes.

Two more consequences worth knowing:

- **Weights collapse.** pptx has only bold/regular, so `font-weight: 600` renders
  as bold and slightly heavier than the deck.
- **Text does not reflow.** A wrapped paragraph becomes one text box per
  rendered line, absolutely positioned. Editing the text in PowerPoint will not
  re-wrap it. This is the price of matching the browser's line breaking exactly.

The dump is also locked to the 1280×720 @ 1.15 zoom frame that `export-slides.mjs`
uses. Change one and change the other, or the pptx and the reference PNGs
diverge.

## Build

```sh
cd slides && bun run dump:data && bun run dump:layout && cd ..
uv run pptx_build/build_deck.py
```

Re-run all three after changing anything in `slides/src/`.

## Check

Renders the pptx through headless LibreOffice and diffs each slide against the
Svelte PNG in `output/`:

```sh
uv run pptx_build/check_deck.py
```

Writes `output/check/compare_N.png` (reference above, pptx below) and prints a
mean absolute pixel difference. Expect ~5/255 — that residue is antialiasing
plus font weight: CSS `font-weight: 600` (Inter SemiBold) has no pptx
equivalent, so `render.py` maps everything ≥ 600 to bold.

## Fonts

The deck uses **Inter** and **JetBrains Mono**. Both must be installed for the
pptx to render as designed; without them PowerPoint substitutes and the measured
line boxes will no longer match the glyphs sitting in them.

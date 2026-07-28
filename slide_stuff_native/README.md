# Native python-pptx deck

Builds `output/coax-deck.pptx` — 7 slides, 16:9 — directly with python-pptx,
with no HTML/SVG intermediate.

```bash
bun run ts/dump.ts     # physics → data/slide-data.json (formatted display strings)
uv run build_deck.py   # JSON → output/coax-deck.pptx
uv run verify_deck.py  # structural assertions
```

## One source of truth for the numbers

`ts/compute.ts` imports the interactive calculator's own modules directly from
`../../src/lib` — nothing is vendored or copied, so the deck cannot drift from
the app. `ts/format.ts` holds the display helpers (`fmt`, `mm`, `mils`,
`heatParts`, `fmtHeat`).

`ts/dump.ts` evaluates `presetResults` for every (cable × length × frequency ×
stage) the deck shows and writes **already-formatted strings** to
`data/slide-data.json`. Python never computes a physical quantity and never
rounds — it only places strings. `verify_deck.py` re-reads the JSON and asserts
every figure actually appears on its slide.

Heat cells carry both `text` (the `fmtHeat` string) and `v`/`u` (from
`heatParts`), so the unit can be set smaller and greyer without formatting the
value twice.

## Files

| File | Role |
| --- | --- |
| `ts/compute.ts` | Preset → `CoaxResults`, importing the live app physics |
| `ts/format.ts` | Display formatting helpers |
| `ts/dump.ts` | Writes `data/slide-data.json` |
| `theme.py` | Palette, type scale, shape/text primitives |
| `crosssection.py` | Grouped vector cable cross-section, drawn to real geometry |
| `table.py` | Slide 6's real `GraphicFrame` table |
| `build_deck.py` | Slide layout |
| `verify_deck.py` | Asserts 16:9, 7 slides, real table, grouped shapes, no overflow |

## Style

Ported from the HTML/Svelte version's exported PNGs: white ground, Inter for
prose, JetBrains Mono for every number, one accent per cable (Samtec `#2A6FB0`,
N12 `#B9701A`). Cross-sections draw both cables at a **common scale**, so the
N12's larger OD reads as genuinely larger, and colour the strands by metal
(silver-plated copper vs brass).

Two rendering gotchas, both handled in `theme.py`:

- **Combining marks.** `Q̇` and `T̄` lose their mark in Inter, and letter-spacing
  (`spc`) breaks the cluster in any font. Those glyphs are emitted as JetBrains
  Mono runs with no letter-spacing.
- **`smart_upper`.** Uppercasing a label containing `α` would turn it into a
  Latin `A`; only ASCII is uppercased.

Fonts are Inter and JetBrains Mono. If the deck is opened where those aren't
installed, PowerPoint will substitute.

## Rendering check

```bash
soffice --headless --convert-to pdf output/coax-deck.pptx
```

`output/page*.png` are 105 dpi renders of that PDF. Note that at low dpi the dot
on `Q̇` disappears into a pixel — zoom before assuming it's missing.

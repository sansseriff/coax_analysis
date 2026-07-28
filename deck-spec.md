# Deck spec — Cryogenic Micro-Coax: Loss & Heat-Load Projections

Build a 7-slide PowerPoint deck (16:9) from this specification and the
TypeScript coax calculator in this repo.

This document says **what each slide must communicate and what form it should
take**. It does not prescribe a layout, a colour palette, type scale, or spacing.
Those are yours. Where it says "a table" or "a picture", that is a requirement
about the *kind* of object; everything about how it looks is your call.

---

## Audience and argument

Cryostat wiring engineers choosing between two candidate 50 Ω stranded
micro-coax cables for a 208-line harness. They already know the physics; they
want the numbers.

The deck makes one argument, and every slide should serve it:

> **There is no free lunch.** The Samtec TCF-3450F (silver-plated copper) has
> far lower RF insertion loss. The N12-42M (brass) conducts far less heat into
> the cold stage. The right choice depends on which budget is tighter, and the
> gap between them changes with assembly length.

Keep the two cables visually distinguishable throughout — one accent colour
each, used consistently on every slide. The reader should be able to tell at a
glance which column, row or number belongs to which cable.

---

## Where the numbers come from

**Do not re-derive any physics or re-implement any formatting.** The deck's
credibility rests on it agreeing exactly with the interactive calculator.

Every displayed value comes from `slides/src/lib/`:

```ts
import { SAMTEC, N12, presetResults, inches } from './compute';
import { fmt, mm, mils, heatParts, fmtHeat } from './format';
import { awgToMeters } from './physics/awg';

presetResults(preset, lengthM, freqHz, stage) → CoaxResults
```

- `presetResults` takes a `CoaxPreset` (use the exported `SAMTEC` and `N12`),
  a length in **metres** (use `inches(n)`), a frequency in **Hz**, and a
  `Stage` of `'40to4'` or `'4to1'`.
- Read these fields off `CoaxResults`: `Z0` (Ω), `cableOD` (m),
  `alphaTotal_dBm` (dB/m), `totalLoss_dB` (dB), `Qtotal_uW` (µW).
- Format with the helpers in `format.ts`: `fmt(v, digits)`, `mm(m)`, `mils(m)`,
  `heatParts(uW) → {v, u}` (value and unit separately, for styling the unit
  smaller), and `fmtHeat(uW) → "35.3 mW"` (single string, for tables). These
  handle the µW/mW/W tier switching — do not round by hand.

Since python-pptx is the natural tool for the build, the practical bridge is a
small TypeScript script that calls the above and writes a JSON file of
already-formatted display strings, which Python then reads. There is an existing
example at `slides/scripts/dump-slide-data.ts`. Reuse or rewrite it; just don't
let a number get computed twice.

### Constants the deck is built on

| Constant | Value |
| --- | --- |
| Assembly lengths | 3″, 5″, 10″, 15″, 18″ |
| Low frequency | 2 GHz (the headline figure) |
| High frequency | 4 GHz |
| RF stage | `'40to4'` (T̄ ≈ 22 K) |
| Heat-load stages | `'40to4'` (40 K → 4 K) and `'4to1'` (4 K → 1 K) |
| Full harness | 208 cables (13 cables of 16 lines) |

Insertion loss is always quoted at the `'40to4'` stage. Heat load is reported
for both stages.

---

## Slide 0 — Title

A **hero title slide**, not a bullet list. It has to land the topic and
introduce the two cables before any numbers appear.

Must contain:

- An eyebrow/kicker line: `50 Ω stranded micro-coax · cryostat wiring`
- The headline: **Insertion Loss & Heat-Load Projections**
- A one-sentence lede naming the two cables and the five assembly lengths
  (3″, 5″, 10″, 15″, 18″), with the lengths emphasised.
- **Two side-by-side spec cards**, one per cable, each showing the cable's
  `name`, its `description` (straight off the preset), and three
  length-independent figures: `Z₀` in Ω, cable OD in **both mm and mils**, and
  `α` at 2 GHz in dB/m. Evaluate at any nominal length — these don't depend on it.
- A small methodology footnote: Pozar conductor loss + dielectric loss, with a
  per-conductor stranding factor `K_s` calibrated to the TCF-3450F insertion-loss
  curve (1–4 GHz); heat load is steady-state conduction across each cryostat
  stage's ΔT, with lay-angle path corrections.

This is where the two accent colours get established.

---

## Slides 1–5 — One per assembly length

Five slides, one each for 3″, 5″, 10″, 15″, 18″. Identical structure, different
numbers. Title each with the length in both units, e.g. `3″ assembly · 76 mm`
(millimetres rounded to a whole number).

A **two-column split view**, one column per cable, side by side so the reader
compares across. Each column carries, for that cable at that length:

1. The cable `name` and `description`.
2. A **cross-section picture** of the cable (see below).
3. The two length-independent specs, `Z₀` and cable OD (mm and mils), visually
   subordinate to the numbers below — these are context, not the point.
4. **RF insertion loss**, as a labelled group: total dB at **2 GHz** and at
   **4 GHz**. The 2 GHz figure is the headline; 4 GHz is secondary.
5. **Conducted heat load, per cable**, as a labelled group: **40 K → 4 K** and
   **4 K → 1 K**. The 40 K → 4 K figure is the headline; 4 K → 1 K is secondary.

Give the headline numbers real typographic weight — this deck is read from
across a room. Set each value's unit smaller than its number (`heatParts`
returns them separately for exactly this reason).

Below the two columns, a single **trade-off line** stating both advantages as
"× lower" ratios so each reads ≥ 1:

> Trade-off · **TCF-3450F** 6.9× lower loss · **N12-42M** 66× lower heat

Compute these as `n12.totalLoss_dB / samtec.totalLoss_dB` and
`samtec.Qtotal_uW / n12.Qtotal_uW`, both at 2 GHz / `'40to4'`. (They are
length-independent, so the same two ratios appear on all five slides. That
repetition is the point: it tells the reader the trade-off doesn't go away.)

Close with a footnote on the model and the fact that both cables are 50 Ω.

### The cross-section picture

A circular, schematic end-on view of the cable, drawn to the preset's real
geometry. Vector shapes or an embedded image are both fine.

- Inner conductor: a 7-strand hex bundle — one strand at the centre, six around
  it at a distance of `2·rInner`, each of radius `rInner = awgToMeters(innerAwg)/2`.
- Outer shield: `nOuter` strands of radius `awgToMeters(outerAwg)/2`, spaced
  evenly around a ring of radius `rRing_um · 1e-6`.
- Dielectric: a filled disc between the core and the shield.
- Jacket: an outer disc at `rRing + rOuterStrand`.
- Colour the strands by metal: the copper preset and the brass preset should be
  visibly different materials.

The two cables have genuinely different geometry (36 vs 32 shield strands,
different ring radii and OD), so the pictures should not look identical.

---

## Slide 6 — Summary

All five lengths at a glance. This is the slide people will photograph, and the
one they will try to lift into their own deck.

**It must be a real PowerPoint table** — a `GraphicFrame`, not a grid of text
boxes — so that it stays selectable, editable and pasteable.

One row per assembly length. Columns grouped under each cable, and within each
cable:

| | Loss @ 2 GHz | Q̇ per cable, 40→4 K | Q̇ per cable, 4→1 K | Q̇ ×208, 40→4 K | Q̇ ×208, 4→1 K |
| --- | --- | --- | --- | --- | --- |

That is ten data columns plus a leading `Length` column. The bundle figures are
simply the per-cable heat load multiplied by 208; format them with `fmtHeat`,
which will promote them into mW and W as needed.

Visual guidance:

- Make the two cable groups clearly separate — a header spanning each, in that
  cable's accent colour.
- The bundle (×208) columns are the ones that decide the cryostat budget. Give
  them emphasis over the per-cable columns.
- The 4→1 K columns are an order of magnitude smaller and less critical. Let
  them recede.
- Label the harness explicitly somewhere: `208 (13 cables of 16 lines)`.

Footnote: insertion loss quoted at 2 GHz, 4–40 K stage; heat load is conducted
Q̇ across each stage's ΔT, shown per cable and for the full harness; point back
to the per-length slides for the 4 GHz figures.

---

## Deliverable

A single `.pptx`, 16:9, seven slides, with:

- native text (selectable, and ideally editable — prefer real text frames with
  wrapping over one box per rendered line),
- a real table on slide 6,
- the cross-sections as pictures or grouped shapes,
- related elements grouped (a value with its unit, a label with the shape it
  sits on) so the deck is workable in PowerPoint.

Verify it renders. `soffice --headless --convert-to pdf` is a reasonable way to
look at the result without opening PowerPoint.

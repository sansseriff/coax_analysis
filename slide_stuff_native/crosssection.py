"""Schematic end-on view of a stranded micro-coax, drawn to real geometry.

Vector shapes only — the result is a single grouped shape the user can select,
move and recolour in PowerPoint. Both cables are drawn at a *common* scale, so
the N12's larger outside diameter reads as genuinely larger on the slide.
"""

from __future__ import annotations

import math

from theme import (
    DIELECTRIC,
    DIELECTRIC_LINE,
    JACKET,
    JACKET_LINE,
    METAL_FILL,
    METAL_LINE,
    circle,
)


def cross_section(shapes, geom: dict, cx: int, cy: int, scale: float):
    """Draw one cable's cross-section centred at (cx, cy).

    `scale` is EMU per metre; `geom` comes straight from the JSON dump.
    Layering, outermost first: jacket disc, dielectric disc, shield strands,
    7-strand inner bundle.
    """
    g = shapes.add_group_shape()
    gs = g.shapes

    r_inner = geom["rInner"] * scale
    r_strand = geom["rOuterStrand"] * scale
    r_ring = geom["rRing"] * scale
    r_diel = geom["b"] * scale
    r_jacket = geom["rJacket"] * scale
    n_outer = int(geom["nOuter"])

    fill = METAL_FILL[geom["metal"]]
    line = METAL_LINE[geom["metal"]]

    # Jacket: outer disc at rRing + rOuterStrand.
    circle(gs, cx, cy, r_jacket, fill=JACKET, line=JACKET_LINE, lw=1.0)

    # Dielectric: filled disc out to the shield's inner face.
    circle(gs, cx, cy, r_diel, fill=DIELECTRIC, line=DIELECTRIC_LINE, lw=0.5)

    # Shield: nOuter strands evenly spaced around the ring.
    for i in range(n_outer):
        th = 2 * math.pi * i / n_outer - math.pi / 2
        circle(gs, cx + r_ring * math.cos(th), cy + r_ring * math.sin(th), r_strand,
               fill=fill, line=line, lw=0.35)

    # Inner conductor: 7-strand hex bundle — one centre strand, six at 2·rInner.
    circle(gs, cx, cy, r_inner, fill=fill, line=line, lw=0.4)
    for i in range(6):
        th = 2 * math.pi * i / 6 - math.pi / 2
        circle(gs, cx + 2 * r_inner * math.cos(th), cy + 2 * r_inner * math.sin(th), r_inner,
               fill=fill, line=line, lw=0.4)

    return g


def common_scale(geoms, frame_radius_emu: float) -> float:
    """EMU per metre such that the widest cable just fills the frame."""
    return frame_radius_emu / max(g["rJacket"] for g in geoms)

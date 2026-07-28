"""Render the built pptx with LibreOffice and diff it against the Svelte PNGs.

Usage:  uv run pptx_build/check_deck.py [slide_index ...]

Writes output/check/slide_N.png (LibreOffice's render) and
output/check/compare_N.png (reference above, pptx below), then prints a
per-slide mean absolute pixel difference so regressions are obvious without
having to eyeball all seven slides.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pypdfium2
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output"
DECK = OUTPUT / "coax-projections.pptx"
CHECK = OUTPUT / "check"

SOFFICE = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")
WIDTH = 2000  # comparison width; the references are 2560×1440


def render_pdf() -> Path:
    CHECK.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(SOFFICE), "--headless", "--convert-to", "pdf", "--outdir", str(CHECK), str(DECK)],
        check=True,
        capture_output=True,
    )
    return CHECK / f"{DECK.stem}.pdf"


def pdf_to_pngs(pdf: Path) -> list[Path]:
    doc = pypdfium2.PdfDocument(pdf)
    out = []
    for i, page in enumerate(doc):
        dest = CHECK / f"slide_{i}.png"
        page.render(scale=WIDTH / page.get_width()).to_pil().save(dest)
        out.append(dest)
    return out


def fit(img: Image.Image) -> Image.Image:
    h = round(img.height * WIDTH / img.width)
    return img.convert("RGB").resize((WIDTH, h), Image.LANCZOS)


def compare(index: int, rendered: Path) -> float:
    reference = OUTPUT / f"slide_{index}.png"
    ref, got = fit(Image.open(reference)), fit(Image.open(rendered))
    if ref.size != got.size:
        got = got.resize(ref.size, Image.LANCZOS)

    stack = Image.new("RGB", (ref.width, ref.height * 2), "white")
    stack.paste(ref, (0, 0))
    stack.paste(got, (0, ref.height))
    stack.save(CHECK / f"compare_{index}.png")

    return sum(ImageStat.Stat(ImageChops.difference(ref, got)).mean) / 3


def main() -> None:
    wanted = [int(a) for a in sys.argv[1:]]
    pngs = pdf_to_pngs(render_pdf())
    for i, png in enumerate(pngs):
        if wanted and i not in wanted:
            continue
        print(f"slide {i}: mean abs diff {compare(i, png):6.2f} / 255")


if __name__ == "__main__":
    main()
